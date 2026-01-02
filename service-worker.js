// Service Worker for RPC Demo
// This needs to be in public/ to have root scope

const $FETCH_HEADER = 'RPC_RR_PROXY'
const $STREAM_REQUEST_HEADER = 'RPC_STREAM_REQUEST_HEADER'

// Fetch RPC methods
const fetchMethods = {
  getUser(id) {
    return {
      id,
      name: `User ${id}`,
      email: `user${id}@example.com`,
      createdAt: new Date().toISOString(),
    }
  },

  listUsers() {
    return [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
      { id: 3, name: 'Charlie', email: 'charlie@example.com' },
    ]
  },

  createUser(data) {
    return {
      id: Math.floor(Math.random() * 1000),
      ...data,
      createdAt: new Date().toISOString(),
    }
  },

  api: {
    status() {
      return { status: 'ok', uptime: Date.now() }
    },
    echo(message) {
      return { echo: message, timestamp: Date.now() }
    },
  },
}

// Stream RPC methods
const streamMethods = {
  ping() {
    return 'pong'
  },
  time() {
    return new Date().toISOString()
  },
}

// Helper to call nested methods
function callMethod(methods, topics, args) {
  let current = methods
  for (const topic of topics) {
    current = current[topic]
    if (current === undefined) {
      throw new Error(`Method not found: ${topics.join('.')}`)
    }
  }
  if (typeof current !== 'function') {
    throw new Error(`Not a function: ${topics.join('.')}`)
  }
  return current(...args)
}

// Fetch RPC handler
async function handleFetchRpc(event) {
  try {
    const json = await event.request.json()
    const { args, topics } = json

    const payload = await callMethod(fetchMethods, topics, args)
    return new Response(JSON.stringify({ payload }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(null, {
      statusText: error?.message || 'Unknown error',
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// Stream RPC state
const encoder = new TextEncoder()
const decoder = new TextDecoder()

// Stream RPC handler
function handleStreamRpc(request) {
  const reader = request.body.getReader()
  let buffer = ''

  const stream = new ReadableStream({
    async start(controller) {
      const processMessages = async () => {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          let newlineIndex
          while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIndex)
            buffer = buffer.slice(newlineIndex + 1)

            try {
              const data = JSON.parse(line)
              if (data.request !== undefined && data.payload) {
                const { topics, args } = data.payload
                const result = await callMethod(streamMethods, topics, args)
                const response = JSON.stringify({
                  response: data.request,
                  payload: result
                }) + '\n'
                controller.enqueue(encoder.encode(response))
              }
            } catch (e) {
              console.error('[SW] Stream parse error:', e)
            }
          }
        }
        controller.close()
      }
      processMessages().catch(e => console.error('[SW] Stream error:', e))
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

self.addEventListener('install', (event) => {
  console.log('[SW] Installing...')
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...')
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Handle Fetch RPC requests
  if (url.pathname.startsWith('/api/') && event.request.headers.has($FETCH_HEADER)) {
    console.log('[SW] Handling fetch RPC:', url.pathname)
    event.respondWith(handleFetchRpc(event))
    return
  }

  // Handle Stream RPC requests
  if (url.pathname === '/stream-rpc' && event.request.headers.has($STREAM_REQUEST_HEADER)) {
    console.log('[SW] Handling stream RPC')
    event.respondWith(handleStreamRpc(event.request))
    return
  }
})

console.log('[SW] Script loaded')
