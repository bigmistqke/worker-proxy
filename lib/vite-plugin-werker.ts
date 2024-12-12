import { existsSync } from 'fs'

export default () => {
  return {
    name: 'werker-transform', // Required, will show up in warnings and errors
    load(id: string) {
      if (id.endsWith('?worker_file&type=module')) {
        const originalPath = id.replace('?worker_file&type=module', '')

        // Worker wrapper
        const code = /* javascript */ `import getApi from "${originalPath}"
const workerChannels = {}
const api = getApi(
  new Proxy(
    {},
    {
      get(_, workerName) {
        return new Proxy(
          {},
          {
            get(_, property) {
              if (property === "transfer") {
                return (...transferables) => {
                  return new Proxy(
                    {},
                    {
                      get(_, property) {
                        return (...data) =>
                          self.postMessage(
                            { topic: property, data },
                            transferables
                          )
                      },
                    }
                  )
                }
              }
              return (...data) => {
                workerChannels[workerName]?.postMessage({
                  topic: property,
                  data,
                })
              }
            },
          }
        )
      },
    }
  )
)
self.onmessage = ({ data: { topic, data, name, port } }) => {
  if (topic === "send") {
    workerChannels[name] = port
    return
  }
  if (topic === "receive") {
    port.onmessage = ({ data: { topic, data } }) => {
      api[topic](...data)
    }
    return
  }
  api[topic](...data)
}`

        return code
      }
      if (id.endsWith('?werker')) {
        const originalPath = id.replace('?werker', '')

        if (!existsSync(originalPath)) {
          return null // No file, no processing
        }

        // Client proxy for worker
        const code = /* javascript */ `
export default function(workers){
  const eventTarget = new EventTarget()
  const worker = new Worker(new URL("${originalPath}", import.meta.url), { type: 'module' });
  worker.onmessage = ({data: {topic, data}}) => eventTarget.dispatchEvent(new CustomEvent(topic, {detail: data}))
  return new Proxy({}, {
    get(target, property) {
      if(property === 'postMessage'){
        return (...args) => worker.postMessage(...args)
      }
      if(property === 'transfer'){
        return (...transferables) => {
          return new Proxy({}, {
            get(_, property){
              return (...data) => {
                worker.postMessage({topic: property, data }, transferables)
              }
            }
          })
        }
      }
      if(property === 'link'){
        return (name, otherWorker) => {
          const channel = new MessageChannel();
          worker.postMessage({topic: 'send', name, port: channel.port1}, [channel.port1])
          otherWorker.postMessage({topic: 'receive', name, port: channel.port2}, [channel.port2])
        }
      }
      if(property === 'on'){
          return new Proxy({}, {
            get(_, property){
              return (callback) => {
                const abortController = new AbortController();
                eventTarget.addEventListener(property, (event) => callback(...event.detail), {signal: abortController.signal })
                return () => abortController.abort()
              }
            }
          })
      }
      return (...data) => {
        worker.postMessage({topic: property, data })
      }
    }
  })
}`

        return code
      }
    }
  }
}
