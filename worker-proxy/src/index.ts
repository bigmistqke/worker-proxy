export * from "./types.ts"
import type { $Transfer, Fn, WorkerProxy, WorkerProxyPort } from './types.ts'

function createProxy<T extends object = object>(
  callback: (property: string | symbol) => void
) {
  return new Proxy({} as T, {
    get(_, property) {
      return callback(property)
    }
  })
}

function isTransfer(value: any): value is $Transfer {
  return value && typeof value === 'object' && '$transfer' in value && value.$transfer
}

export function createWorkerProxy<T extends Worker | WorkerProxyPort<any>>(worker: T) {
  let id = 0
  const pendingMessages: Record<
    string,
    { resolve: (value: unknown) => void; reject: (value: unknown) => void }
  > = {}
  const eventTarget = new EventTarget()

  function postMessage(topic: string | symbol, data: $Transfer | Array<any>) {
    if (isTransfer(data[0])) {
      const [_data, transferables] = data[0]
      worker.postMessage(
        {
          topic,
          data: _data
        },
        transferables
      )
    } else {
      worker.postMessage({
        topic,
        data
      })
    }
  }

  const asyncProxy = createProxy(topic => {
    return (...data: Array<unknown>) => {
      id++
      postMessage(topic, data)
      return new Promise((resolve, reject) => {
        pendingMessages[id] = { resolve, reject }
      })
    }
  })

  worker.onmessage = ({ data: { topic, data, id, error } }) => {
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

  return createProxy<T extends WorkerProxyPort<Fn> ? WorkerProxy<T['$']> : WorkerProxy<T>>(
    topic => {
      switch (topic) {
        case '$port':
          return () => {
            const { port1, port2 } = new MessageChannel()
            worker.postMessage({ port: port1 }, [port1])
            return port2
          }
        case '$async':
          return asyncProxy
        case '$on':
          return createProxy(property => {
            return (callback: (...data: Array<unknown>) => void) => {
              const abortController = new AbortController()
              eventTarget.addEventListener(
                property as string,
                event => callback(...(event as Event & { detail: Array<unknown> }).detail),
                {
                  signal: abortController.signal
                }
              )
              return () => abortController.abort()
            }
          })
        default:
          return (...data: Array<any>) => postMessage(topic, data)
      }
    }
  )
}

export function createWorkerMethods(getApi: unknown) {
  const api =
    typeof getApi === 'function'
      ? getApi(
          createProxy(
            topic =>
              (...data: Array<unknown>) =>
                postMessage(topic as string, data)
          )
        )
      : getApi

  function postMessage(topic: string, data: Array<unknown>) {
    if (isTransfer(data[0])) {
      self.postMessage({ topic, data: data[0][0] }, '/', data[0][1])
    } else {
      self.postMessage({ topic, data })
    }
  }
  async function onMessage({ data: { topic, data, port, id } }: any) {
    if (port) {
      port.onmessage = onMessage
      return
    }
    if (id !== undefined) {
      try {
        const result = await api[topic](...data)
        postMessage(topic, result)
      } catch (error) {
        self.postMessage({ id, error })
      }
      return
    }
    api[topic](...data)
  }

  self.onmessage = onMessage
}

export function $transfer<const T extends Array<any>, const U extends Array<Transferable>>(
  ...args: [...T, U]
) {
  const transferables = args.pop()
  const result = [args, transferables] as unknown as $Transfer<T, U>
  result.$transfer = true
  return result
}
