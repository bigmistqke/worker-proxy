# `@bigmistqke/vite-plugin-worker-proxy`

Vite plugin to improve worker DX.

## Table of Contents

- [basics](#basics) _A simple example_
- [$on](#on) _Subscribe to calls_
- [$transfer](#transfer) _Transfer `Transferables`_
- [$async](#async) _Await responses of worker-methods_
- [$port](#port) _Expose a WorkerProxy's api to another WorkerProxy_

## Basics

A simple example

**main.ts**

```tsx
import type WorkerApi from './worker'
import Worker from './worker?worker-proxy'

// Create WorkerProxy
const worker = new Worker<typeof WorkerApi>()

// Call log-method of worker
worker.log('hello', 'bigmistqke')
```

**worker.ts**

```tsx
import { WorkerProps } from '@bigmistqke/vite-plugin-worker-proxy'

export default () => ({
  log(...args: Array<string>) {
    console.log(...args)
  }
})
```

## $on

Subscribe to calls from WorkerProxy with `worker.$on(...)`

**main.ts**

```tsx
import type WorkerApi from './worker'
import Worker from './worker?worker-proxy'

// Create WorkerProxy
const worker = new Worker<typeof WorkerApi>()

// Subscribe to pong-calls of worker
worker.$on.pong(data => {
  console.log('pong', data)
  setTimeout(() => worker.ping(performance.now()), 1000)
})

// Call ping-method of worker
worker.ping(performance.now())
```

**worker.ts**

```tsx
import { WorkerProps } from '@bigmistqke/vite-plugin-worker-proxy'

export default (
  props: WorkerProps<{
    pong: (timestamp: number) => void
  }>
) => ({
  ping(timestamp: number) {
    console.log('ping', timestamp)
    setTimeout(() => props.pong(performance.now()), 1000)
  }
})
```

## $async

Await responses of WorkerProxy-methods with `worker.$async.method(...)`

**main.ts**

```tsx
import { $transfer } from '@bigmistqke/vite-plugin-worker-proxy'
import Worker from './worker?worker-proxy'
import type WorkerApi from './worker'

const worker = new Worker<typeof WorkerApi>()

worker.$async.ask('question').then(console.log)
```

**worker.ts**

```tsx
export default () => ({
  ask(question: string) {
    return new Promise(resolve => setTimeout(() => resolve('Answer'), 1000))
  }
})
```

## $transfer

Transfer `Transferables` to/from WorkerProxies with `$transfer(...)`

**main.ts**

```tsx
import { $transfer } from '@bigmistqke/vite-plugin-worker-proxy'
import Worker from './worker?worker-proxy'
import type WorkerApi from './worker'

const worker = new Worker<typeof WorkerApi>()

const buffer = new ArrayBuffer()

// Transfer buffer to worker
worker.setBuffer($transfer(buffer, [buffer]))

// Transfer buffer from worker back to main thread
worker.$async.getBuffer().then(console.log)
```

**worker.ts**

```tsx
let buffer: ArrayBuffer
export default () => ({
  setBuffer(_buffer: ArrayBuffer) {
    buffer = _buffer
  },
  getBuffer() {
    return $transfer(buffer, [buffer])
  }
})
```

## $port

Expose a WorkerProxy's API to another WorkerProxy with `worker.$port()` and `createWorkerProxy()`

**main.ts**

```tsx
import { $transfer } from '@bigmistqke/vite-plugin-worker-proxy'
import HalloWorker from './hallo-worker?worker-proxy'
import type HalloWorkerApi from './hallo-worker'
import GoodbyeWorker from './goodbye-worker?worker-proxy'
import type GoodbyeWorkerApi from './goodbye-worker'

const halloWorker = new HalloWorker<typeof HalloWorkerApi>()
const goodbyeWorker = new GoodbyeWorker<typeof GoodbyeWorkerApi>()

// Get a WorkerPort of goodbyeWorker
const port = goodbyeWorker.$port()

// Transfer the WorkerPort to halloWorker
halloWorker.link($transfer(port, [port]))

halloWorker.hallo()
```

**hallo-worker.ts**

```tsx
import {
  WorkerProxy,
  WorkerProxyPort,
  createWorkerProxy
} from '@bigmistqke/vite-plugin-worker-proxy'
import type GoodbyeWorkerApi from './goodbye-worker'

let goodbyeWorker: WorkerProxy<typeof GoodbyeWorkerApi>

export default () => ({
  hallo() {
    console.log('hallo')
    setTimeout(() => goodbyeWorker.goodbye(), 1000)
  },
  link(port: WorkerProxyPort<typeof GoodbyeWorkerApi>) {
    // Create WorkerProxy from the given WorkerProxyPort
    goodbyeWorker = createWorkerProxy(port)
  }
})
```

**goodbye-worker.ts**

```tsx
export default () => ({
  goodbye() {
    console.log('goodbye')
  }
})
```
