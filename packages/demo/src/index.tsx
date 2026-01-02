/* @refresh reload */
import { Route, Router } from '@solidjs/router'
import { render } from 'solid-js/web'
import Layout from './App'
import Fetch from './pages/Fetch'
import Home from './pages/Home'
import Messenger from './pages/Messenger'
import SSE from './pages/SSE'
import Stream from './pages/Stream'
import './styles.css'

render(
  () => (
    <Router base="rpc" root={Layout}>
      <Route path="/" component={Home} />
      <Route path="/messenger" component={Messenger} />
      <Route path="/fetch" component={Fetch} />
      <Route path="/stream" component={Stream} />
      <Route path="/sse" component={SSE} />
    </Router>
  ),
  document.getElementById('app')!,
)
