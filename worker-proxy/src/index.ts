export * from './types.js'
import { $CALLBACK } from './constants.js'
import type { $Callback, $Transfer, Fn, WorkerProxy, WorkerProxyPort } from './types.js'

let CALLBACK_ID = 0
const CALLBACK_MAP = new Map<number, WeakRef<$Callback>>()
const finalizationRegistry = new FinalizationRegistry((id: number) => CALLBACK_MAP.delete(id))

function createProxy<T extends object = object>(callback: (property: string | symbol) => void) {
  return new Proxy({} as T, {
    get(_, property) {
      return callback(property)
    },
  })
}

function isTransfer(value: any): value is $Transfer {
  return Array.isArray(value) && '$transferable' in value
}

/**
 * Wraps a worker in a WorkerProxy.
 *
 * Accepts either a
 * - `Worker`
 * - `string`: _will create a worker from given url_
 * - `WorkerProxyPort`: _a MessagePort created by `workerProxy.$port()`_
 *
 * When given a `Worker | string` you can type the proxy with a generic.
 * When given a `WorkerProxyPort` it will infer the types
 * from the `WorkerProxy` that created the port.
 *
 * @example
 *
 * ```tsx
 * import { createWorkerProxy } from "@bigmistqke/worker-proxy"
 * import type Methods from "./worker.ts"
 *
 * const workerProxy = createWorkerProxy<typeof Methods>(new Worker('./worker.ts'))
 * const port = workerProxy.$port()
 *
 * // type automatically inferred.
 * const otherProxy = createWorkerProxy(port)
 * ```
 */
export function createWorkerProxy<T extends WorkerProxyPort<any>>(input: T): WorkerProxy<T['$']>
export function createWorkerProxy<T>(input: string | Worker): WorkerProxy<T>
export function createWorkerProxy(input: WorkerProxyPort<any> | Worker | string) {
  const worker = typeof input === 'string' ? new Worker(input) : input

  let id = 0
  const pendingMessages: Record<
    string,
    { resolve: (value: unknown) => void; reject: (value: unknown) => void }
  > = {}
  const eventTarget = new EventTarget()

  function postMessage(topic: string | symbol, data: $Transfer | Array<any>, id?: number) {
    if (data && isTransfer(data[0])) {
      worker.postMessage(
        {
          topic,
          data: data[0],
          id,
        },
        data[0].$transferables,
      )
    } else {
      worker.postMessage({
        topic,
        data,
        id,
      })
    }
  }

  const asyncProxy = createProxy(topic => {
    return (...data: Array<unknown>) => {
      id++
      postMessage(topic, data, id)
      return new Promise((resolve, reject) => {
        pendingMessages[id] = { resolve, reject }
      })
    }
  })

  worker.onmessage = ({ data: { topic, data, id, error, callback, args } }) => {
    if (callback || args) {
      CALLBACK_MAP.get(callback)?.deref()?.(...args)
      return
    }
    if (pendingMessages[id]) {
      if (error) {
        pendingMessages[id].reject(error)
      } else {
        pendingMessages[id].resolve(data)
      }
      delete pendingMessages[id]
      return
    }
    eventTarget.dispatchEvent(new CustomEvent(topic, { detail: data }))
  }

  return createProxy(topic => {
    switch (topic) {
      case '$port':
        return () => {
          const { port1, port2 } = new MessageChannel()
          worker.postMessage({ port: port1 }, [port1])
          return port2
        }
      case '$async':
        return asyncProxy
      default:
        return (...args: Array<any>) => {
          for (let i = 0; i < args.length; i++) {
            const arg = args[i]
            // Serialize callbacks
            if (typeof arg === 'function') {
              const result = $callback(arg)
              args[i] = {
                [$CALLBACK]: result[$CALLBACK],
                // Add flag that it should automatically deserialize this callback
                auto: true,
              }
            }
          }
          return postMessage(topic, args)
        }
    }
  })
}

/**
 * Prepare worker for commands of `WorkerProxy` by registering its methods.
 *
 * Accepts an object of methods
 *
 * Returns the input, for ease of typing:
 *
 * @example
 *
 * ```tsx
 * // worker.ts
 * import { registerMethods } from '@bigmistqke/worker-proxy'
 *
 * export default registerMethods({ hallo: () => console.log('hallo') })
 *
 * // main.ts
 * import { createWorkerProxy } from '@bigmistqke/worker-proxy'
 * import type Methods from './worker.ts'
 *
 * const workerProxy = createWorkerProxy<typeof Methods>(new Worker('./worker.ts'))
 * workerProxy.hallo()
 * ```
 */
export function registerMethods<T extends Record<string, Fn>>(api: T) {
  function postMessage(topic: string, data: Array<unknown>, id?: number) {
    if (data && isTransfer(data[0])) {
      self.postMessage({ topic, data: data[0][0], id }, '/', data[0][1])
    } else {
      self.postMessage({ topic, data, id })
    }
  }
  async function onMessage({ data: { topic, data, port, id } }: any) {
    if (port) {
      port.onmessage = onMessage
      return
    }

    for (let i = 0; i < data.length; i++) {
      const callback = data[i]
      // Deserialize callback
      if (typeof callback === 'object' && $CALLBACK in callback && callback.auto) {
        data[i] = (...args: Array<any>) => $apply(callback, ...args)
      }
    }

    if (id !== undefined) {
      try {
        const result = await api[topic]!(...data)
        postMessage(topic, result, id)
      } catch (error) {
        self.postMessage({ id, error })
      }
      return
    }

    api[topic]!(...data)
  }

  self.onmessage = onMessage

  // Return the argument for typing purposes
  return api
}

/**
 * Utility function to accomodate for `Transferables`
 *
 * @example
 *
 * ```tsx
 * const buffer = new ArrayBuffer()
 *
 * // This will clone the buffer
 * workerProxy.sendBuffer(ab)
 *
 * // This will transfer the buffer without cloning
 * workerProxy.sendBuffer($transfer(ab, [ab]))
 * ```
 *
 * @example
 *
 * Also works when returning a value from a
 *
 * ```tsx
 * // main.ts
 * workerProxy.$async.getBuffer().then(console.log)
 *
 * // worker.ts
 * const buffer = new ArrayBuffer()
 *
 * const methods = {
 *   getBuffer(){
 *     return $transfer(ab, [ab])
 *   }
 * }
 * ```
 */
export function $transfer<const T extends Array<any>, const U extends Array<Transferable>>(...args: [...T, U]) {
  const transferables = args.pop()
  const result = args as unknown as $Transfer<T, U>
  result.$transferables = transferables as U
  return result
}

export function $callback(callback: ((...args: Array<any>) => void) & { [$CALLBACK]?: number }) {
  let id = $CALLBACK in callback ? callback[$CALLBACK] : undefined
  if (!id) {
    id = ++CALLBACK_ID
    callback[$CALLBACK] = id
    CALLBACK_MAP.set(id, new WeakRef(callback as $Callback))
    finalizationRegistry.register(callback, id)
  }
  return { [$CALLBACK]: id } as unknown as $Callback
}

export function $apply<T extends $Callback>(callback: T, ...args: Parameters<T>) {
  self.postMessage({ callback: callback[$CALLBACK], args })
}
