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

const links: {
  hand: Link | undefined
  shake: Link | undefined
} = {
  hand: undefined,
  shake: undefined,
}

const refreshes = new Set<() => void>()

sw.addEventListener('fetch', async (event: FetchEvent) => {
  const pathname = new URL(event.request.url).pathname
  console.log('pathname', pathname)

  if (pathname.includes('rpc-refresh')) {
    console.log('RPC REFRESH!')
    const { proxy, response, onClose } = server(event.request.body!, methods)
    refreshes.add(proxy.reload)
    onClose(() => refreshes.delete(proxy))

    /* setTimeout(() => {
      proxy.reload()
    }, 2_000) */

    event.respondWith(response)
  } else if (pathname.includes('rpc-proxy-lib.js')) {
    event.respondWith(
      new Response(raw, { headers: { 'Content-Type': 'text/javascript; charset=utf-8' } }),
    )
  } else if (isStreamRequest(event)) {
    const { response } = server(event.request.body!, methods)
    event.respondWith(response)
  } else if (pathname.includes('rpc-javascript-test.js')) {
    event.respondWith(
      new Response(
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
      ),
    )
  } else if (pathname.includes('hallo')) {
    event.respondWith(
      new Response(world, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      }),
    )
  }
})

sw.addEventListener('install', () => {
  sw.skipWaiting()
})

sw.addEventListener('activate', event => {
  event.waitUntil(sw.clients.claim())
})
