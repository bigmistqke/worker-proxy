import { client } from '@bigmistqke/rpc/stream'
import { Component, createSignal, For, onMount } from 'solid-js'
import type { StreamMethods } from '../../service.worker'
import { BASE } from '../constants'

interface LogEntry {
  type: 'request' | 'response' | 'error' | 'info'
  message: string
  timestamp: number
}

const Stream: Component = () => {
  const [logs, setLogs] = createSignal<LogEntry[]>([])
  const [ready, setReady] = createSignal(false)
  const [connected, setConnected] = createSignal(false)
  let proxyRef: ReturnType<typeof client<StreamMethods>>['proxy'] | null = null

  const log = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, { type, message, timestamp: Date.now() }])
  }

  onMount(async () => {
    // Register service worker from public folder
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register(`${BASE}/service-worker.js`, {
          scope: `${BASE}/`,
        })
        await navigator.serviceWorker.ready
        setReady(true)
        log('info', 'Service Worker ready')

        // Connect to stream RPC
        const { proxy, onClose, closed } = client<StreamMethods>(`${BASE}/stream-rpc`, {})
        proxyRef = proxy
        setConnected(true)
        log('info', 'Stream RPC connected')

        onClose(() => {
          setConnected(false)
          log('info', 'Stream closed')
        })
      } catch (e) {
        log('error', `Failed to connect: ${e}`)
      }
    }
  })

  const callPing = async () => {
    if (!proxyRef) return
    log('request', `ping()`)
    try {
      const result = await proxyRef.ping()
      log('response', `"${result}"`)
    } catch (e) {
      log('error', String(e))
    }
  }

  const callTime = async () => {
    if (!proxyRef) return
    log('request', `time()`)
    try {
      const result = await proxyRef.time()
      log('response', `"${result}"`)
    } catch (e) {
      log('error', String(e))
    }
  }

  return (
    <div class="page">
      <h1>Stream RPC</h1>
      <p>
        Bidirectional streaming RPC with custom codec support. Uses ReadableStream for efficient
        data transfer.
      </p>

      <div class="status">
        <span class={`status-dot ${connected() ? 'connected' : ''}`} />
        {connected()
          ? 'Stream Connected'
          : ready()
          ? 'Connecting...'
          : 'Waiting for Service Worker...'}
      </div>

      <div class="demo-section">
        <div>
          <div class="card">
            <h2>Try It</h2>
            <p style={{ 'margin-bottom': '1rem' }}>
              Stream RPC maintains a persistent bidirectional connection. Messages are serialized
              using a custom codec system that supports complex types.
            </p>

            <div class="button-group">
              <button class="button" onClick={callPing} disabled={!connected()}>
                ping()
              </button>
              <button class="button" onClick={callTime} disabled={!connected()}>
                time()
              </button>
            </div>
          </div>

          <div class="card">
            <h2>Features</h2>
            <ul style={{ 'padding-left': '1.5rem', color: 'var(--text-muted)' }}>
              <li>Bidirectional streaming communication</li>
              <li>Custom codec system for serialization</li>
              <li>Support for ReadableStream, TypedArrays, Sets, Maps</li>
              <li>Efficient binary encoding</li>
              <li>Generator/AsyncGenerator support for streaming data</li>
            </ul>
          </div>

          <div class="card">
            <h2>Code</h2>
            <div class="code-block">
              {`// service-worker.ts
import { server, isStreamRequest } from '@bigmistqke/rpc/stream'

const methods = {
  ping: () => 'pong',
  time: () => new Date().toISOString(),
}

self.addEventListener('fetch', event => {
  if (isStreamRequest(event)) {
    const { response } = server(
      event.request.body!,
      methods
    )
    event.respondWith(response)
  }
})

// main.ts
import { client } from '@bigmistqke/rpc/stream'

const { proxy, onClose } = client<Methods>(
  '/stream-rpc',
  {} // exposed methods (optional)
)

await proxy.ping()   // "pong"
await proxy.time()   // "2024-01-01T00:00:00.000Z"

onClose(() => console.log('Stream closed'))`}
            </div>
          </div>

          <div class="card">
            <h2>Custom Codec Example</h2>
            <div class="code-block">
              {`import { createStreamCodec, PrimitiveCodec } from '@bigmistqke/rpc/stream'

// Custom codec for Set
const SetCodec = new StructuralCodec({
  test: (v): v is Set<any> => v instanceof Set,
  encode: (set) => ({
    length: set.size,
    values: set.values()
  }),
  decode: () => {
    const items: any[] = []
    return {
      value: new Set(items),
      set: (v) => items.push(v)
    }
  }
})

const codec = createStreamCodec([SetCodec])`}
            </div>
          </div>
        </div>

        <div>
          <div class="card">
            <div
              style={{
                display: 'flex',
                'justify-content': 'space-between',
                'align-items': 'center',
                'margin-bottom': '1rem',
              }}
            >
              <h2>Output</h2>
              <button
                class="button"
                style={{ padding: '0.5rem 1rem', 'font-size': '0.8rem' }}
                onClick={() => setLogs([])}
              >
                Clear
              </button>
            </div>
            <div class="output" style={{ 'min-height': '400px' }}>
              <For each={logs()}>
                {entry => (
                  <div class={`output-line ${entry.type}`}>
                    <span style={{ color: 'var(--text-muted)', 'margin-right': '0.5rem' }}>
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    {entry.type === 'request' ? '>' : entry.type === 'info' ? '*' : '<'}{' '}
                    {entry.message}
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Stream
