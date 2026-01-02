/* @refresh reload */
import { render } from 'solid-js/web'
import { Router, Route } from '@solidjs/router'
import Layout from './App'
import Home from './pages/Home'
import Messenger from './pages/Messenger'
import Fetch from './pages/Fetch'
import Stream from './pages/Stream'
import SSE from './pages/SSE'
import './styles.css'

render(
  () => (
    <Router root={Layout}>
      <Route path="/" component={Home} />
      <Route path="/messenger" component={Messenger} />
      <Route path="/fetch" component={Fetch} />
      <Route path="/stream" component={Stream} />
      <Route path="/sse" component={SSE} />
    </Router>
  ),
  document.getElementById('app')!,
)
