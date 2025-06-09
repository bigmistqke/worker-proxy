/// <reference lib="webworker" />

import { StreamClientMethods } from './dev/main'
import raw from './dist/stream.js?raw'
import { isStreamRequest, server } from './src/stream'
import { RPC } from './src/types'

const sw = self as unknown as ServiceWorkerGlobalScope

let id = 0
let proxies = new Array<RPC<StreamClientMethods>>()
let world = 'world'
let javascript = `requestAnimationFrame(() => {
document.body.style.background = 'blue'
})`

const methods = {
  cursor(id: number, x: number, y: number) {
    proxies.forEach(proxy => {
      proxy.cursor(id, x, y)
    })
  },
  getId() {
    return ++id
  },
  setWorld(_world: string) {
    world = _world
  },
  setJavascript(_javascript: string) {
    if (javascript !== _javascript) {
      refreshes.forEach(refresh => refresh())
    }
    javascript = _javascript
  },
  getJavascript() {
    return javascript
  },
}
export type StreamServerMethods = typeof methods

interface Link {
  stream: ReadableStream
  link(stream: ReadableStream): void
}

const refreshes = new Set<() => void>()

function createRouter(
  routes: Record<string, (event: FetchEvent) => Response>,
  { base = '' }: { base?: string } = {},
) {
  return function (event: FetchEvent) {
    const pathname = new URL(event.request.url).pathname
    const route = routes[`${base}${pathname}`]
    if (route) {
      event.respondWith(route(event))
      return true
    }
    return false
  }
}

const router = createRouter({
  '/hallo/rpc-refresh'(event) {
    const { proxy, response, onClose } = server<{ reload(): void }>(event.request.body!, methods)
    refreshes.add(proxy.reload)
    onClose(() => refreshes.delete(proxy.reload))
    return response
  },
  '/hallo/rpc-proxy-lib.js'() {
    return new Response(raw, { headers: { 'Content-Type': 'text/javascript; charset=utf-8' } })
  },
  '/hallo/rpc-javascript-test.js'() {
    return new Response(
      `import("./rpc-proxy-lib.js").then(({ client }) => {
client("rpc-refresh", {
  reload() {
    window.location.reload()
  },
})
})
${javascript}`,
      {
        headers: {
          'Content-Type': 'text/javascript; charset=utf-8',
        },
      },
    )
  },
  '/hallo/index.html'() {
    return new Response(world, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  },
})

sw.addEventListener('fetch', async (event: FetchEvent) => {
  if (router(event)) {
    return
  }
  if (isStreamRequest(event)) {
    const { response } = server(event.request.body!, methods)
    event.respondWith(response)
  }
})

sw.addEventListener('install', () => {
  sw.skipWaiting()
})

sw.addEventListener('activate', event => {
  event.waitUntil(sw.clients.claim())
})
