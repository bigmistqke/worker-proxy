import { rpc } from '@bigmistqke/rpc/fetch'
import { Component, createSignal, For, onMount } from 'solid-js'
import { BASE } from '../constants'
import type { FetchMethods } from '../workers/service.worker'

interface LogEntry {
  type: 'request' | 'response' | 'error'
  message: string
  timestamp: number
}

const Fetch: Component = () => {
  const [logs, setLogs] = createSignal<LogEntry[]>([])
  const [ready, setReady] = createSignal(false)
  const [userId, setUserId] = createSignal('1')
  const [newUserName, setNewUserName] = createSignal('John')
  const [newUserEmail, setNewUserEmail] = createSignal('john@example.com')
  const [echoMessage, setEchoMessage] = createSignal('Hello!')

  const proxy = rpc<FetchMethods>(`${BASE}/api`)

  const log = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, { type, message, timestamp: Date.now() }])
  }

  onMount(async () => {
    // Register service worker from public folder
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register(`${BASE}/service-worker.js`, {
          scope: `${BASE}/`,
        })
        await navigator.serviceWorker.ready
        setReady(true)
        log('response', 'Service Worker registered')
      } catch (e) {
        log('error', `Failed to register Service Worker: ${e}`)
      }
    }
  })

  const callGetUser = async () => {
    const id = Number(userId())
    log('request', `getUser(${id})`)
    try {
      const result = await proxy.getUser(id)
      log('response', JSON.stringify(result, null, 2))
    } catch (e) {
      log('error', String(e))
    }
  }

  const callListUsers = async () => {
    log('request', `listUsers()`)
    try {
      const result = await proxy.listUsers()
      log('response', JSON.stringify(result, null, 2))
    } catch (e) {
      log('error', String(e))
    }
  }

  const callCreateUser = async () => {
    const data = { name: newUserName(), email: newUserEmail() }
    log('request', `createUser(${JSON.stringify(data)})`)
    try {
      const result = await proxy.createUser(data)
      log('response', JSON.stringify(result, null, 2))
    } catch (e) {
      log('error', String(e))
    }
  }

  const callApiStatus = async () => {
    log('request', `api.status()`)
    try {
      const result = await proxy.api.status()
      log('response', JSON.stringify(result, null, 2))
    } catch (e) {
      log('error', String(e))
    }
  }

  const callApiEcho = async () => {
    const msg = echoMessage()
    log('request', `api.echo("${msg}")`)
    try {
      const result = await proxy.api.echo(msg)
      log('response', JSON.stringify(result, null, 2))
    } catch (e) {
      log('error', String(e))
    }
  }

  return (
    <div class="page">
      <h1>Fetch RPC</h1>
      <p>HTTP-based RPC using fetch. Requests are handled by a Service Worker.</p>

      <div class="status">
        <span class={`status-dot ${ready() ? 'connected' : ''}`} />
        {ready() ? 'Service Worker Ready' : 'Registering Service Worker...'}
      </div>

      <div class="demo-section">
        <div>
          <div class="card">
            <h2>User API</h2>

            <div style={{ 'margin-bottom': '1rem' }}>
              <label
                style={{ display: 'block', 'margin-bottom': '0.5rem', color: 'var(--text-muted)' }}
              >
                User ID:
              </label>
              <input
                class="input"
                type="number"
                value={userId()}
                onInput={e => setUserId(e.currentTarget.value)}
              />
            </div>

            <div class="button-group">
              <button class="button" onClick={callGetUser} disabled={!ready()}>
                getUser(id)
              </button>
              <button class="button" onClick={callListUsers} disabled={!ready()}>
                listUsers()
              </button>
            </div>
          </div>

          <div class="card">
            <h2>Create User</h2>

            <div style={{ 'margin-bottom': '1rem' }}>
              <label
                style={{ display: 'block', 'margin-bottom': '0.5rem', color: 'var(--text-muted)' }}
              >
                Name:
              </label>
              <input
                class="input"
                value={newUserName()}
                onInput={e => setNewUserName(e.currentTarget.value)}
              />
            </div>

            <div style={{ 'margin-bottom': '1rem' }}>
              <label
                style={{ display: 'block', 'margin-bottom': '0.5rem', color: 'var(--text-muted)' }}
              >
                Email:
              </label>
              <input
                class="input"
                value={newUserEmail()}
                onInput={e => setNewUserEmail(e.currentTarget.value)}
              />
            </div>

            <button class="button" onClick={callCreateUser} disabled={!ready()}>
              createUser(data)
            </button>
          </div>

          <div class="card">
            <h2>Nested API</h2>

            <div style={{ 'margin-bottom': '1rem' }}>
              <label
                style={{ display: 'block', 'margin-bottom': '0.5rem', color: 'var(--text-muted)' }}
              >
                Echo Message:
              </label>
              <input
                class="input"
                value={echoMessage()}
                onInput={e => setEchoMessage(e.currentTarget.value)}
              />
            </div>

            <div class="button-group">
              <button class="button" onClick={callApiStatus} disabled={!ready()}>
                api.status()
              </button>
              <button class="button" onClick={callApiEcho} disabled={!ready()}>
                api.echo(msg)
              </button>
            </div>
          </div>

          <div class="card">
            <h2>Code</h2>
            <div class="code-block">
              {`// service-worker.ts
import { expose, isFetchRequest } from '@bigmistqke/rpc/fetch'

const handler = expose({
  getUser: (id: number) => ({ id, name: \`User \${id}\` }),
  listUsers: () => [{ id: 1, name: 'Alice' }],
  api: {
    status: () => ({ status: 'ok' }),
  },
})

self.addEventListener('fetch', event => {
  if (isFetchRequest(event)) {
    event.respondWith(handler(event))
  }
})

// main.ts
import { rpc } from '@bigmistqke/rpc/fetch'

const proxy = rpc<Methods>('/api')
await proxy.getUser(1)      // { id: 1, name: "User 1" }
await proxy.api.status()    // { status: "ok" }`}
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
                    {entry.type === 'request' ? '>' : '<'} {entry.message}
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

export default Fetch
