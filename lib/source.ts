import { $MessagePort, Fn, WorkerProxy } from './types'

export function getWorkerSource(filePath: string) {
  return /* javascript */ `import getApi from '${filePath}'

function createProxy(callback) {
  return new Proxy({}, {
    get(_, property) {
      if (typeof property === 'symbol') return
      return callback(property)
    }
  })
}

const proxy = createProxy(topic =>
  topic === '$transfer'
    ? createProxy(
        topic =>
          (...data) => {
            const transferables = data.pop()
            self.postMessage({ topic, data }, transferables)
          }
      )
    : (...data) => {
        self.postMessage({
          topic,
          data
        })
      }
)

const api = getApi(proxy)

async function onMessage ({ data: { topic, data, name, port, id } }) {
  if(port){
    port.onmessage = onMessage
    return
  }
  if (id !== undefined) {
    try{
      const result = await api[topic](...data)
      self.postMessage({ id, data: result })
    }catch(error){
      self.postMessage({ id, error })
    }
    return
  }
  api[topic](...data)
}

self.onmessage = onMessage`
}

export function getClientSource(workerUrl: string) {
  return /* javascript */ `
import { createWorkerProxy } from "vite-plugin-worker-proxy/source"
export default function(workers){
  const worker = new Worker(${JSON.stringify(workerUrl)}, { type: 'module' });
  return createWorkerProxy(worker)
};`
}

export function createWorkerProxy<T extends Worker | $MessagePort<Fn>>(worker: T) {
  let id = 0
  const pendingMessages: Record<
    string,
    { resolve: (value: unknown) => void; reject: (value: unknown) => void }
  > = {}
  const eventTarget = new EventTarget()

  const asyncProxy = createProxy(property => {
    return (...data: Array<unknown>) => {
      id++
      worker.postMessage({ topic: property, data, id })
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

  return createProxy<T extends $MessagePort<Fn> ? WorkerProxy<T['$']> : WorkerProxy<T>>(
    property => {
      if (property === 'postMessage') {
        return worker.postMessage.bind(worker)
      }
      if (property === '$port') {
        return () => {
          const messageChannel = new MessageChannel()
          worker.postMessage({ port: messageChannel.port1 }, [messageChannel.port1])
          return messageChannel.port2
        }
      }
      if (property === '$async') {
        return asyncProxy
      }
      if (property === '$transfer') {
        return createProxy(property => {
          if (property === '$async') {
            return asyncProxy
          }
          return (...data: Array<any>) => {
            const transferables = data.pop()
            worker.postMessage({ topic: property, data }, transferables)
          }
        })
      }
      if (property === '$on') {
        return createProxy(property => {
          return (callback: (...args: Array<unknown>) => void) => {
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
      }
      return (...data: Array<unknown>) => {
        worker.postMessage({ topic: property, data })
      }
    }
  )
}

export function createProxy<T extends object = object>(
  callback: (property: string | symbol) => void
) {
  return new Proxy({} as T, {
    get(_, property) {
      return callback(property)
    }
  })
}
