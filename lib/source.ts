import { $MessagePort, Fn, WorkerProxy } from './types'

export function getWorkerSource(filePath: string) {
  return /* javascript */ `import getApi from '${filePath}'

function postMessage(topic, data) {
  const last = data[data.length - 1]
  if (last && typeof last === 'object' && '$transfer' in last && last.$transfer) {
    const transferables = data.pop()
    self.postMessage(
      {
        topic,
        data
      },
      '/',
      transferables
    )
  } else {
    self.postMessage({
      topic,
      data
    })
  }
}

function createProxy(callback) {
  return new Proxy({}, {
    get(_, property) {
      if (typeof property === 'symbol') return
      return callback(property)
    }
  })
}

const api = getApi(createProxy(topic =>
  (...data) => postMessage(topic, data)
))

async function onMessage ({ data: { topic, data, name, port, id } }) {
  if(port){
    port.onmessage = onMessage
    return
  }
  if (id !== undefined) {
    try{
      const result = await api[topic](...data)
      postMessage(topic, result)
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

  function postMessage(topic: string | symbol, data: Array<any>) {
    if (isTransfer(data[data.length - 1])) {
      const transferables = data.pop()
      worker.postMessage(
        {
          topic,
          data
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

  return createProxy<T extends $MessagePort<Fn> ? WorkerProxy<T['$']> : WorkerProxy<T>>(topic => {
    if (topic === 'postMessage') {
      return worker.postMessage.bind(worker)
    }
    if (topic === '$port') {
      return () => {
        const messageChannel = new MessageChannel()
        worker.postMessage({ port: messageChannel.port1 }, [messageChannel.port1])
        return messageChannel.port2
      }
    }
    if (topic === '$async') {
      return asyncProxy
    }
    if (topic === '$on') {
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
    }
    return (...data: Array<any>) => postMessage(topic, data)
  })
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

type $Transfer<T = Array<any>, U = Array<Transferable>> = [T, U] & { $transfer: true }

export function $transfer<const T extends Array<Transferable>>(...args: T) {
  // @ts-expect-error
  args.$transfer = true
  return args as T & { $transfer: true }
}

export function isTransfer(value: any): value is $Transfer {
  return value && typeof value === 'object' && '$transfer' in value && value.$transfer
}
