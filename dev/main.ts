import { client } from 'src/stream'
import { StreamServerMethods } from '../service'
import { codec } from './codec'

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
  container.style.zIndex = '-1'
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
    const { proxy } = client<StreamServerMethods>('stream', streamClientMethods, codec)

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
