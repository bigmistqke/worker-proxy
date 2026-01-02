/* @refresh reload */
import { Route, Router, useNavigate } from '@solidjs/router'
import { onMount, ParentProps } from 'solid-js'
import { render } from 'solid-js/web'
import Layout from './App'
import { BASE } from './constants'
import Fetch from './pages/Fetch'
import Home from './pages/Home'
import Messenger from './pages/Messenger'
import SSE from './pages/SSE'
import Stream from './pages/Stream'
import './styles.css'

function RedirectHandler(props: ParentProps) {
  const navigate = useNavigate()

  onMount(() => {
    const params = new URLSearchParams(location.search)
    const redirect = params.get('redirect')
    if (redirect) {
      // Clean URL and navigate
      history.replaceState(null, '', location.pathname)
      navigate(redirect, { replace: true })
    }
  })

  return props.children
}

render(
  () => (
    <Router base={BASE} root={(props) => <RedirectHandler><Layout {...props} /></RedirectHandler>}>
      <Route path="/" component={Home} />
      <Route path="messenger" component={Messenger} />
      <Route path="fetch" component={Fetch} />
      <Route path="stream" component={Stream} />
      <Route path="sse" component={SSE} />
    </Router>
  ),
  document.getElementById('app')!,
)
