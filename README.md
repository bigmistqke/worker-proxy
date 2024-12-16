# `@bigmistqke/vite-plugin-worker-proxy`

Vite plugin to improve dx with workers.

## Table of Contents

- [basics](#basics): A simple example.
- [$on](#on): Subscribe to calls
- [$transfer](#transfer): Transfer `Transferables`
- [$async](#async): Await responses of worker-methods
- [$port](#port): Expose a WorkerProxy's api to another WorkerProxy.

## Basics

**main.ts**

```tsx
import type WorkerApi from './worker'
import Worker from './worker?werker'

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

Subscribe to calls from the worker with `worker.$on`

**main.ts**

```tsx
import type WorkerApi from './worker'
import Worker from './worker?werker'

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

## $transfer

Transfer `Transferables` with `$transfer`

```tsx
import { $transfer } from '@bigmistqke/vite-plugin-worker-proxy'
import Worker from './worker?werker'
import type WorkerApi from './worker'

const worker = new Worker<typeof WorkerApi>()

const buffer = new ArrayBuffer()

// Transfer buffer to worker
worker.setBuffer(buffer, $transfer(buffer))
```

**worker.ts**

```tsx
export default () => ({
  setBuffer(buffer: ArrayBuffer) {
    console.log(buffer)
  }
})
```

## $async

Await responses of worker-methods with `worker.$async.method(...)`.

**main.ts**

```tsx
import { $transfer } from '@bigmistqke/vite-plugin-worker-proxy'
import Worker from './worker?werker'
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

## $port

Expose a WorkerProxy's api to another WorkerProxy with `worker.$port()` and `createWorkerProxy`.

**main.ts**

```tsx
import { $transfer } from '@bigmistqke/vite-plugin-worker-proxy'
import HalloWorker from './hallo-worker?werker'
import type HalloWorkerApi from './hallo-worker'
import GoodbyeWorker from './goodbye-worker?werker'
import type GoodbyeWorkerApi from './goodbye-worker'

const halloWorker = new HalloWorker<typeof HalloWorkerApi>()
const goodbyeWorker = new GoodbyeWorker<typeof GoodbyeWorkerApi>()

// Get WorkerPort of goodbyeWorker
const port = goodbyeWorker.$port()

// Transfer WorkerPort to halloWorker
halloWorker.link(port, $transfer(port))

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
