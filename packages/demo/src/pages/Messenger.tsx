import { rpc } from '@bigmistqke/rpc/messenger'
import { Component, createSignal, For, onCleanup, onMount } from 'solid-js'
import type { WorkerMethods } from '../workers/messenger.worker'
import Worker from '../workers/messenger.worker.ts?worker'

interface LogEntry {
  type: 'request' | 'response' | 'error'
  message: string
  timestamp: number
}

const Messenger: Component = () => {
  const [logs, setLogs] = createSignal<LogEntry[]>([])
  const [connected, setConnected] = createSignal(false)
  const [inputName, setInputName] = createSignal('World')
  const [inputA, setInputA] = createSignal('5')
  const [inputB, setInputB] = createSignal('3')

  // Store proxy outside of signals to avoid SolidJS reactivity interfering with Proxy
  let worker: Worker | null = null
  let proxy: ReturnType<typeof rpc<WorkerMethods>> | null = null

  const log = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, { type, message, timestamp: Date.now() }])
  }

  onMount(() => {
    worker = new Worker()

    proxy = rpc<WorkerMethods>(worker)
    setConnected(true)
    log('response', 'Worker connected')
  })

  onCleanup(() => {
    worker?.terminate()
  })

  const callGreet = async () => {
    if (!proxy) return
    const name = inputName()
    log('request', `greet("${name}")`)
    try {
      const result = await proxy.greet(name)
      log('response', `"${result}"`)
    } catch (e) {
      log('error', String(e))
    }
  }

  const callAdd = async () => {
    if (!proxy) return
    const a = Number(inputA())
    const b = Number(inputB())
    log('request', `add(${a}, ${b})`)
    try {
      const result = await proxy.add(a, b)
      log('response', `${result}`)
    } catch (e) {
      log('error', String(e))
    }
  }

  const callMultiply = async () => {
    if (!proxy) return
    const a = Number(inputA())
    const b = Number(inputB())
    log('request', `multiply(${a}, ${b})`)
    try {
      const result = await proxy.multiply(a, b)
      log('response', `${result}`)
    } catch (e) {
      log('error', String(e))
    }
  }

  const callNested = async () => {
    if (!proxy) return
    const n = Number(inputA())
    log('request', `math.square(${n})`)
    try {
      const result = await proxy.math.square(n)
      log('response', `${result}`)
    } catch (e) {
      log('error', String(e))
    }
  }

  const callFactorial = async () => {
    if (!proxy) return
    const n = Number(inputA())
    log('request', `math.factorial(${n})`)
    try {
      const result = await proxy.math.factorial(n)
      log('response', `${result}`)
    } catch (e) {
      log('error', String(e))
    }
  }

  const callSlow = async () => {
    if (!proxy) return
    log('request', `slowOperation(1000)`)
    try {
      const result = await proxy.slowOperation(1000)
      log('response', `"${result}"`)
    } catch (e) {
      log('error', String(e))
    }
  }

  return (
    <div class="page">
      <h1>Messenger RPC</h1>
      <p>Request-response RPC over postMessage. Communicating with a Web Worker.</p>

      <div class="status">
        <span class={`status-dot ${connected() ? 'connected' : ''}`} />
        {connected() ? 'Worker Connected' : 'Connecting...'}
      </div>

      <div class="demo-section">
        <div>
          <div class="card">
            <h2>Try It</h2>

            <div style={{ 'margin-bottom': '1rem' }}>
              <label
                style={{ display: 'block', 'margin-bottom': '0.5rem', color: 'var(--text-muted)' }}
              >
                Name:
              </label>
              <input
                class="input"
                value={inputName()}
                onInput={e => setInputName(e.currentTarget.value)}
                placeholder="Enter name"
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', 'margin-bottom': '1rem' }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: 'block',
                    'margin-bottom': '0.5rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  A:
                </label>
                <input
                  class="input"
                  type="number"
                  value={inputA()}
                  onInput={e => setInputA(e.currentTarget.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: 'block',
                    'margin-bottom': '0.5rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  B:
                </label>
                <input
                  class="input"
                  type="number"
                  value={inputB()}
                  onInput={e => setInputB(e.currentTarget.value)}
                />
              </div>
            </div>

            <div class="button-group">
              <button class="button" onClick={callGreet}>
                greet(name)
              </button>
              <button class="button" onClick={callAdd}>
                add(a, b)
              </button>
              <button class="button" onClick={callMultiply}>
                multiply(a, b)
              </button>
            </div>

            <div class="button-group" style={{ 'margin-top': '0.5rem' }}>
              <button class="button" onClick={callNested}>
                math.square(a)
              </button>
              <button class="button" onClick={callFactorial}>
                math.factorial(a)
              </button>
              <button class="button" onClick={callSlow}>
                slowOperation(1s)
              </button>
            </div>
          </div>

          <div class="card">
            <h2>Code</h2>
            <div class="code-block">
              {`// worker.ts
import { expose } from '@bigmistqke/rpc/messenger'

expose({
  greet: (name: string) => \`Hello, \${name}!\`,
  add: (a: number, b: number) => a + b,
  math: {
    square: (n: number) => n * n,
  },
})

// main.ts
import { rpc } from '@bigmistqke/rpc/messenger'

const worker = new Worker('./worker.ts')
const proxy = rpc<Methods>(worker)

await proxy.greet('World')  // "Hello, World!"
await proxy.math.square(5)  // 25`}
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
            <div class="output">
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

export default Messenger
