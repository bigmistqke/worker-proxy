import { client } from 'src/stream'
import { StreamServerMethods } from '../service'
import { codec } from './codec'

const cursors: Record<string, HTMLElement> = {}
const playground = element({
  tagName: 'iframe',
  src: '/hallo/index.html',
  parentElement: document.body,
})
let textarea: HTMLTextAreaElement

const streamClientMethods = {
  cursor(id: number, x: number, y: number) {
    if (!cursors[id]) {
      cursors[id] = element({
        style: {
          position: 'fixed',
          top: '0px',
          left: '0px',
          zIndex: '-1',
        },
        parentElement: document.body,
        children: [
          element({
            style: {
              background: `hsl(${(id * Math.floor(360 / 7)) % 360}, 50%,50%)`,
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              transform: 'translate(-50%,-50%)',
            },
          }),
        ],
      })
    }
    cursors[id].style.transform = `translate(${x}px, ${y}px)`
  },
  alert(value: string) {
    console.error('ALERT!!', value)
  },
}

export type StreamClientMethods = typeof streamClientMethods

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

function element<K extends keyof HTMLElementTagNameMap = 'div'>({
  tagName,
  ...properties
}: Partial<Omit<HTMLElementTagNameMap[K], 'style' | 'children'>> & {
  tagName?: K
  style?: Partial<HTMLElementTagNameMap[K]['style']>
  children?: Array<Element>
} = {}) {
  const element = document.createElement<K>(tagName || 'div')
  Object.entries(properties || {}).forEach(([key, value]) => {
    switch (key) {
      case 'style':
        Object.entries(value).forEach(([key, value]) => {
          element.style[key] = value
        })
        break
      case 'parentElement':
        value.append(element)
        break
      case 'children':
        value.forEach(element.appendChild.bind(element))
        break
      default:
        element[key] = value
    }
  })
  return element
}
