import { existsSync } from 'fs'

export default () => {
  return {
    name: 'werker-transform', // Required, will show up in warnings and errors
    load(id: string) {
      if (id.endsWith('?worker_file&type=module')) {
        const originalPath = id.replace('?worker_file&type=module', '')

        // Worker wrapper
        const code = /* javascript */ `import getApi from "${originalPath}";
const api = getApi(new Proxy({}, {
  get(_, property){
    return (...data) => self.postMessage({topic: property, data})
  }
}))
self.onmessage = ({data: {topic, data}}) => api[topic](...data)`

        return code
      }
      if (id.endsWith('?werker')) {
        const originalPath = id.replace('?werker', '')

        if (!existsSync(originalPath)) {
          return null // No file, no processing
        }

        // Client proxy for worker
        const code = /* javascript */ `
export default function(){
  const eventTarget = new EventTarget()
  const worker = new Worker(new URL("${originalPath}", import.meta.url), { type: 'module' });
  worker.onmessage = ({data: {topic, data}}) => eventTarget.dispatchEvent(new CustomEvent(topic, {detail: data}))
  return new Proxy({}, {
    get(target, property) {
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
      return (...data) => worker.postMessage({topic: property, data })
    }
  })
}`

        return code
      }
    }
  }
}
