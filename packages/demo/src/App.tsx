import { A, useLocation } from '@solidjs/router'
import { Component, JSX, ParentComponent } from 'solid-js'

const Layout: ParentComponent = props => {
  const location = useLocation()

  return (
    <div class="layout">
      <nav class="nav">
        <div class="nav-brand">
          <A href="/">@bigmistqke/rpc</A>
        </div>
        <div class="nav-links">
          <A href="/messenger" class={location.pathname === '/messenger' ? 'active' : ''}>
            Messenger
          </A>
          <A href="/fetch" class={location.pathname === '/fetch' ? 'active' : ''}>
            Fetch
          </A>
          <A href="/stream" class={location.pathname === '/stream' ? 'active' : ''}>
            Stream
          </A>
          <A href="/sse" class={location.pathname === '/sse' ? 'active' : ''}>
            SSE
          </A>
        </div>
      </nav>
      <main class="main">{props.children}</main>
    </div>
  )
}

export default Layout
