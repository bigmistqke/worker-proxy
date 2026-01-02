import { A } from '@solidjs/router'
import { Component, createSignal } from 'solid-js'

const Home: Component = () => {
  const [cleared, setCleared] = createSignal(false)

  const clearServiceWorkers = async () => {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map(r => r.unregister()))
    setCleared(true)
    setTimeout(() => setCleared(false), 2000)
  }

  return (
    <div class="page">
      <h1>@bigmistqke/rpc</h1>
      <p>
        A modular RPC toolkit for type-safe communication across Workers, iframes, and network
        boundaries.
      </p>

      <div class="card-grid">
        <A href="/messenger" class="card-link">
          <div class="card">
            <div class="tag">postMessage</div>
            <h3>Messenger RPC</h3>
            <p>
              Simple request-response RPC over postMessage. Perfect for Web Workers and iframe
              communication.
            </p>
          </div>
        </A>

        <A href="/fetch" class="card-link">
          <div class="card">
            <div class="tag">HTTP</div>
            <h3>Fetch RPC</h3>
            <p>
              HTTP-based RPC using fetch. Great for browser-to-server communication with a REST-like
              API.
            </p>
          </div>
        </A>

        <A href="/stream" class="card-link">
          <div class="card">
            <div class="tag">Streaming</div>
            <h3>Stream RPC</h3>
            <p>
              Bidirectional streaming RPC with custom codec support. Ideal for real-time data and
              complex serialization.
            </p>
          </div>
        </A>

        <A href="/sse" class="card-link">
          <div class="card">
            <div class="tag">Server Push</div>
            <h3>SSE RPC</h3>
            <p>
              Server-Sent Events pattern for real-time updates. Useful for live notifications and
              server pushes.
            </p>
          </div>
        </A>
      </div>

      <div class="card" style={{ 'margin-top': '2rem' }}>
        <h2>Features</h2>
        <ul style={{ 'padding-left': '1.5rem', color: 'var(--text-muted)' }}>
          <li>Type-safe RPC calls with full TypeScript support</li>
          <li>Multiple transport mechanisms (MessagePort, fetch, streams, SSE)</li>
          <li>Pluggable codec system for custom serialization</li>
          <li>Automatic callback serialization</li>
          <li>Transfer of Transferable objects (ArrayBuffer, etc.)</li>
        </ul>
      </div>

      <div class="card" style={{ 'margin-top': '2rem' }}>
        <h2>Utilities</h2>
        <button class="button" onClick={clearServiceWorkers}>
          {cleared() ? 'Cleared!' : 'Clear All Service Workers'}
        </button>
        <p style={{ 'margin-top': '0.5rem', color: 'var(--text-muted)', 'font-size': '0.9rem' }}>
          Use this to remove any stale service worker registrations.
        </p>
      </div>
    </div>
  )
}

export default Home
