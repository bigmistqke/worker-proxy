export function getWorkerSource(filePath: string) {
  return /* javascript */ `import getApi from '${filePath}'

function createProxy(callback) {
  return new Proxy(
    {},
    {
      get(_, property) {
        if (typeof property === 'symbol') return
        return callback(property)
      }
    }
  )
}

const channels = { self }
const proxy = createProxy(workerName =>
  createProxy(topic =>
    topic === '$transfer'
      ? createProxy(
          topic =>
            (...data) => {
              const transferables = data.pop()
              channels[workerName]?.postMessage({ topic, data }, transferables)
            }
        )
      : (...data) => {
          channels[workerName]?.postMessage({
            topic,
            data
          })
        }
  )
)

const api = getApi(proxy)

self.onmessage = async ({ data: { topic, data, name, port, id } }) => {
  if (id !== undefined) {
    const result = await api[topic](...data)
    self.postMessage({ id, data: result })
    return
  }
  if (topic === '$send') {
    channels[name] = port
    return
  }
  if (topic === '$receive') {
    port.onmessage = ({ data: { topic, data } }) => {
      api[topic](...data)
    }
    return
  }
  api[topic](...data)
}`
}

export function getClientSource(workerUrl: string) {
  return /* javascript */ `
import { createClientProxy } from "vite-plugin-worker-proxy/source"
export default function(workers){
  const worker = new Worker(${JSON.stringify(workerUrl)}, { type: 'module' });
  return createClientProxy(worker)
};`
}

export function createClientProxy(worker: Worker) {
  let id = 0
  const pendingMessages: Record<string, (value: unknown) => void> = {}
  const eventTarget = new EventTarget()

  const asyncProxy = createProxy(property => {
    return (...data: Array<unknown>) => {
      id++
      worker.postMessage({ topic: property, data, id })
      return new Promise(resolve => {
        pendingMessages[id] = resolve
      })
    }
  })

  worker.onmessage = ({ data: { topic, data, id } }) => {
    if (pendingMessages[id]) {
      pendingMessages[id](data)
      delete pendingMessages[id]
      return
    }
    eventTarget.dispatchEvent(new CustomEvent(topic, { detail: data }))
  }

  return createProxy(property => {
    if (property === 'postMessage') {
      return worker.postMessage.bind(worker)
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
    if (property === '$link') {
      return (name: string, otherWorker: Worker) => {
        const channel = new MessageChannel()
        worker.postMessage({ topic: '$send', name, port: channel.port1 }, [channel.port1])
        otherWorker.postMessage({ topic: '$receive', name, port: channel.port2 }, [channel.port2])
      }
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
  })
}

export function createProxy(callback: (property: string) => void) {
  return new Proxy(
    {},
    {
      get(_, property) {
        if (typeof property === 'symbol') return
        return callback(property)
      }
    }
  )
}
