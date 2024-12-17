# `@bigmistqke/vite-plugin-worker-proxy`

Vite plugin integration of `@bigmistqke/worker-proxy`, automatically wrapping the default exports of `*?worker-proxy` files in a `WorkerProxy`.

## Table of Contents

- [Getting Started](#getting-started)
- [Basic Example](#basics)
- [$on](#on) _Subscribe to calls_
- [$transfer](#transfer) _Transfer `Transferables`_
- [$async](#async) _Await responses of worker-methods_
- [$port](#port) _Expose a WorkerProxy's api to another WorkerProxy_

## Getting Started

**Install Package**

pnpm

```bash
pnpm add --save-dev @bigmistqke/vite-plugin-worker-proxy
pnpm add @bigmistqke/worker-proxy
```

npm

```bash
npm add --save-dev @bigmistqke/vite-plugin-worker-proxy
npm add @bigmistqke/worker-proxy
```

yarn

```bash
yarn add --dev @bigmistqke/vite-plugin-worker-proxy
yarn add --dev @bigmistqke/worker-proxy
```

**Add Types**

To augment the type `*?worker-proxy` imports we need to include `@bigmistqke/vite-plugin-worker-proxy/client` in the `tsconfig.json`.

```json
{
  "compilerOptions": {
    "types": ["vite/client", "@bigmistqke/vite-plugin-worker-proxy/client"]
  }
}
```

## Basic Example

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
import { WorkerProps } from '@bigmistqke/worker-proxy'

// Return object of methods
export default {
  log(...args: Array<string>) {
    console.log(...args)
  }
}
```

## $on

Subscribe to calls from WorkerProxy with `worker.$on(...)`

**main.ts**

```tsx
import type WorkerApi from './worker'
import Worker from './worker?worker-proxy'

// Create WorkerProxy
const worker = new Worker<typeof WorkerApi>()

// Subscribe to .pong prop-method calls of worker
worker.$on.pong(data => {
  console.log('pong', data)
  setTimeout(() => worker.ping(performance.now()), 1000)
})

// Call .ping-method of worker
worker.ping(performance.now())
```

**worker.ts**

```tsx
import { WorkerProps } from '@bigmistqke/worker-proxy'

// Return a function with prop-methods
export default (
  props: WorkerProps<{
    pong: (timestamp: number) => void
  }>
) => ({
  ping(timestamp: number) {
    console.log('ping', timestamp)

    // Call .pong prop-method
    setTimeout(() => props.pong(performance.now()), 1000)
  }
})
```

## $async

Await responses of WorkerProxy-methods with `worker.$async.method(...)`

**main.ts**

```tsx
import Worker from './worker?worker-proxy'
import type WorkerApi from './worker'

const worker = new Worker<typeof WorkerApi>()

// Call async version of ask-method
worker.$async.ask('question').then(console.log)
```

**worker.ts**

```tsx
export default {
  ask(question: string) {
    return 'Answer'
  }
}
```

## $transfer

Transfer `Transferables` to/from WorkerProxies with `$transfer(...)`

**main.ts**

```tsx
import { $transfer } from '@bigmistqke/worker-proxy'
import Worker from './worker?worker-proxy'
import type WorkerApi from './worker'

const worker = new Worker<typeof WorkerApi>()

const buffer = new ArrayBuffer()

// Transfer buffer to worker
worker.setBuffer($transfer(buffer, [buffer]))

// Call async version of getBuffer and log awaited results
worker.$async.getBuffer().then(console.log)
```

**worker.ts**

```tsx
let buffer: ArrayBuffer
export default {
  setBuffer(_buffer: ArrayBuffer) {
    buffer = _buffer
  },
  getBuffer() {
    // Transfer buffer from worker back to main thread
    return $transfer(buffer, [buffer])
  }
}
```

## $port

Expose a WorkerProxy's API to another WorkerProxy with `worker.$port()` and `createWorkerProxy(port)`:

- `worker.$port()` returns a branded `MessagePort`:
  - `WorkerProxyPort<T> = MessagePort & { $: T }`
- `createWorkerProxy` accepts `Worker` and `WorkerProxyPort` as argument.
  - When given a `WorkerProxyPort` it infers its type from the branded type.

**main.ts**

```tsx
import { $transfer } from '@bigmistqke/worker-proxy'
import HalloWorker from './hallo-worker?worker-proxy'
import type HalloWorkerApi from './hallo-worker'
import GoodbyeWorker from './goodbye-worker?worker-proxy'
import type GoodbyeWorkerApi from './goodbye-worker'

const halloWorker = new HalloWorker<typeof HalloWorkerApi>()
const goodbyeWorker = new GoodbyeWorker<typeof GoodbyeWorkerApi>()

// Get a WorkerProxyPort of goodbyeWorker
const port = goodbyeWorker.$port()

// Transfer the WorkerProxyPort to halloWorker
halloWorker.link($transfer(port, [port]))

halloWorker.hallo()
```

**hallo-worker.ts**

```tsx
import { WorkerProxy, WorkerProxyPort, createWorkerProxy } from '@bigmistqke/worker-proxy'
import type GoodbyeWorkerApi from './goodbye-worker'

let goodbyeWorker: WorkerProxy<typeof GoodbyeWorkerApi>

export default {
  hallo() {
    console.log('hallo')
    setTimeout(() => goodbyeWorker.goodbye(), 1000)
  },
  link(port: WorkerProxyPort<typeof GoodbyeWorkerApi>) {
    // Create WorkerProxy from the given WorkerProxyPort
    goodbyeWorker = createWorkerProxy(port)
  }
}
```

**goodbye-worker.ts**

```tsx
export default {
  goodbye() {
    console.log('goodbye')
  }
}
```
