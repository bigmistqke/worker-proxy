import { expose, rpc } from 'src/messenger'
import { client } from 'src/stream'
import { StreamServerMethods } from '../service'
import { IframeMethods } from './iframe'
import type { WorkerGlobalMethods } from './worker-global'
import WorkerGlobal from './worker-global.ts?worker'
import type { WorkerPortMethods } from './worker-port'
import WorkerPort from './worker-port.ts?worker'

export interface SSEMethods {
  log(...values: Array<any>): void
  get(path: string): { date: Date; path: string }
  cursor(id: number, x: number, y: number): void
}

function createCursor(id: number) {
  const element = document.createElement('div')
  element.style.background = `hsl(${(id * Math.floor(360 / 7)) % 360}, 50%,50%)`
  element.style.width = '50px'
  element.style.height = '50px'
  element.style.borderRadius = '50%'
  element.style.transform = 'translate(-50%,-50%)'
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.top = '0px'
  container.style.left = '0px'
  container.style.zIndex = -1
  container.appendChild(element)
  document.body.appendChild(container)
  return container
}

const cursors: Record<string, HTMLElement> = {}

const streamClientMethods = {
  cursor(id: number, x: number, y: number) {
    if (!cursors[id]) {
      cursors[id] = createCursor(id)
    }
    cursors[id].style.transform = `translate(${x}px, ${y}px)`
  },
  alert(value: string) {
    console.error('ALERT!!', value)
  },
}

export type StreamClientMethods = typeof streamClientMethods

function element<K extends keyof HTMLElementTagNameMap>({
  tagName,
  ...properties
}: Partial<HTMLElementTagNameMap[K]> & { tagName?: K } = {}) {
  const element = document.createElement<K>(tagName || 'div')
  Object.entries(properties || {}).forEach(([key, value]) => {
    if (key === 'parentElement') {
      value.appendChild(element)
    } else {
      element[key] = value
    }
  })
  return element
}

// async function handshake(type: 'hand' | 'shake') {
//   const methods = {
//     hand() {
//       element({ tagName: 'span', textContent: 'hand', parentElement: document.body })

//       console.log('hand')
//     },
//     shake() {
//       element({ tagName: 'span', textContent: 'shake', parentElement: document.body })
//       console.log('shake')
//     },
//   }

//   const { proxy } = client<typeof methods>(type, methods)

//   setInterval(() => {
//     proxy[type]()
//   }, 1_000)
// }

// const handButton = document.createElement('button')
// document.body.appendChild(handButton)
// handButton.onclick = () => handshake('hand')
// handButton.textContent = 'hand'

// const shakeButton = document.createElement('button')
// document.body.appendChild(shakeButton)
// shakeButton.onclick = () => handshake('shake')
// shakeButton.textContent = 'shake'

const playground = element({
  tagName: 'iframe',
  src: '/hallo/index.html',
  parentElement: document.body,
})
playground.src = 'hallo/index.html'

let getJavascript: (() => Promise<string>) | undefined = undefined

element({
  tagName: 'button',
  textContent: 'refresh',
  parentElement: document.body,
  onclick() {
    if (textarea) {
      playground.contentWindow?.location.reload()
      const controller = new AbortController()
      playground.addEventListener(
        'load',
        async () => {
          const javascript = await getJavascript?.()
          textarea.value = javascript /* playground.contentWindow!.document.body.innerHTML */ || ''
          controller.abort()
        },
        { signal: controller.signal },
      )
    }
  },
})

let textarea: HTMLTextAreaElement

navigator.serviceWorker
  .register(new URL('../service.ts', import.meta.url), { type: 'module' })
  .then(async () => {
    const { proxy } = client<StreamServerMethods>('stream', streamClientMethods)
    const id = await proxy.getId()

    getJavascript = proxy.getJavascript

    window.addEventListener('mousemove', event => {
      proxy.cursor(id, event.clientX, event.clientY)
    })

    proxy.setWorld('<script type="module" src="./rpc-javascript-test.js"></script>ok')

    const javascript = await proxy.getJavascript()
    textarea = element({
      tagName: 'textarea',
      parentElement: document.body,
      value: javascript,
      oninput(event) {
        proxy.setJavascript((event.currentTarget as HTMLTextAreaElement).value)
        playground.contentWindow!.location.reload()
      },
    })
  })

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
