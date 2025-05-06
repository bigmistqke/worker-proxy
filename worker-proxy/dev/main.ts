import { expose, rpc } from 'src/messenger'
import { IframeMethods } from './iframe'
import type { WorkerGlobalMethods } from './worker-global'
import WorkerGlobal from './worker-global.ts?worker'
import type { WorkerPortMethods } from './worker-port'
import WorkerPort from './worker-port.ts?worker'

// Worker with globally exposed methods
const { ping } = rpc<WorkerGlobalMethods>(new WorkerGlobal())
ping(performance.now()).then(value => console.log('resolved from worker-global:', value))

// Worker with methods exposed through MessagePort
new WorkerPort().addEventListener('message', event => {
  const proxy = rpc<WorkerPortMethods>(event.data)
  proxy.ping(performance.now()).then(value => console.log('resolved from worker-port:', value))
})

// Iframe with globally exposed methods
const iframe = document.querySelector('iframe')
iframe?.addEventListener('load', event => {
  const iframeWindow = (event.currentTarget as HTMLIFrameElement)!.contentWindow!
  const proxy = rpc<IframeMethods>(iframeWindow)
  proxy.ping(performance.now()).then(value => console.log('resolved from iframe:', value))
})

// Globally expose methods (to be consumed in p.ex iframe)
const methods = {
  ping(value: number) {
    console.log('ping from main thread', value)
  },
}
expose(methods)
export type MainMethods = typeof methods
