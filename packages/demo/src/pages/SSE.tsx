import { Component, createSignal, For } from 'solid-js'

interface LogEntry {
  type: 'request' | 'response' | 'error' | 'info'
  message: string
  timestamp: number
}

const SSE: Component = () => {
  const [logs, setLogs] = createSignal<LogEntry[]>([])

  const log = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, { type, message, timestamp: Date.now() }])
  }

  return (
    <div class="page">
      <h1>SSE RPC</h1>
      <p>
        Server-Sent Events pattern for real-time server-to-client communication with
        request-response semantics.
      </p>

      <div class="demo-section">
        <div>
          <div class="card">
            <h2>How It Works</h2>
            <p>
              SSE RPC uses Server-Sent Events for server-to-client communication. The server sends
              RPC requests via SSE, and the client responds via POST requests. This is useful when
              the server needs to initiate actions on the client.
            </p>

            <div style={{ 'margin-top': '1rem' }}>
              <h3 style={{ 'font-size': '1rem', 'margin-bottom': '0.5rem' }}>Flow:</h3>
              <ol style={{ 'padding-left': '1.5rem', color: 'var(--text-muted)' }}>
                <li>Client establishes SSE connection to server</li>
                <li>Server sends RPC requests as SSE events</li>
                <li>Client processes request and POSTs response back</li>
                <li>Server receives response and resolves promise</li>
              </ol>
            </div>
          </div>

          <div class="card">
            <h2>Server Side (Node.js)</h2>
            <div class="code-block">
{`import { rpc } from '@bigmistqke/rpc/server-send-events'

// Create SSE RPC handler
const sseRpc = rpc<ClientMethods>()

app.get('/sse', (req, res) => {
  // Create connection for this client
  const [proxy, { response, onClose }] = sseRpc.create()

  // Pipe SSE response
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })
  response.body.pipeTo(res)

  // Call methods on client
  const result = await proxy.getClientInfo()
  console.log('Client info:', result)

  onClose(() => {
    console.log('Client disconnected')
  })
})

// Handle client responses
app.post('/sse', (req, res) => {
  sseRpc.handleAnswer({ request: req })
  res.end()
})`}
            </div>
          </div>

          <div class="card">
            <h2>Client Side</h2>
            <div class="code-block">
{`import { expose } from '@bigmistqke/rpc/server-send-events'

// Expose methods that server can call
expose('/sse', {
  getClientInfo() {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      timestamp: Date.now(),
    }
  },

  showNotification(message: string) {
    alert(message)
    return { acknowledged: true }
  },

  executeAction(action: string) {
    console.log('Executing:', action)
    return { success: true }
  },
})`}
            </div>
          </div>

          <div class="card">
            <h2>Use Cases</h2>
            <ul style={{ 'padding-left': '1.5rem', color: 'var(--text-muted)' }}>
              <li>Server-initiated actions on client</li>
              <li>Real-time notifications with acknowledgment</li>
              <li>Remote procedure calls from server to browser</li>
              <li>Fallback for browsers without fetch duplex support</li>
              <li>Push-based data synchronization</li>
            </ul>
          </div>
        </div>

        <div>
          <div class="card">
            <h2>Architecture</h2>
            <div class="code-block" style={{ 'text-align': 'center', padding: '2rem' }}>
{`
┌─────────────────┐         ┌─────────────────┐
│                 │   SSE   │                 │
│     Server      │ ──────► │     Client      │
│                 │         │                 │
│  proxy.method() │         │  expose({...})  │
│                 │ ◄────── │                 │
└─────────────────┘   POST  └─────────────────┘

Server sends requests via SSE events
Client sends responses via POST requests
`}
            </div>
          </div>

          <div class="card">
            <h2>Note</h2>
            <p>
              SSE RPC requires a server environment (Node.js, Deno, etc.) to function. This demo
              page shows the API patterns and code examples. For a working demo, you would need to
              run a server that handles SSE connections.
            </p>
            <p style={{ 'margin-top': '1rem' }}>
              The pattern is particularly useful when the server needs to call methods on the
              client, which is the reverse of typical RPC patterns.
            </p>
          </div>

          <div class="card">
            <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'margin-bottom': '1rem' }}>
              <h2>Output</h2>
              <button
                class="button"
                style={{ padding: '0.5rem 1rem', 'font-size': '0.8rem' }}
                onClick={() => setLogs([])}
              >
                Clear
              </button>
            </div>
            <div class="output">
              <For each={logs()} fallback={
                <div style={{ color: 'var(--text-muted)', 'font-style': 'italic' }}>
                  SSE RPC requires a server environment. See code examples for usage.
                </div>
              }>
                {entry => (
                  <div class={`output-line ${entry.type}`}>
                    <span style={{ color: 'var(--text-muted)', 'margin-right': '0.5rem' }}>
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    {entry.type === 'request' ? '>' : entry.type === 'info' ? '*' : '<'} {entry.message}
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

export default SSE
