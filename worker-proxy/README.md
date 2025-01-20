# `@bigmistqke/worker-proxy`

Library to improve worker DX, similar to [ComLink](https://github.com/GoogleChromeLabs/comlink).

## Table of Contents

- [Getting Started](#getting-started)
- [Basic Example](#basics)
- [$on](#on) _Subscribe to calls_
- [$transfer](#transfer) _Transfer `Transferables`_
- [$async](#async) _Await responses of worker-methods_
- [$port](#port) _Expose a WorkerProxy's api to another WorkerProxy_

## Getting Started

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

## Basic Example

**main.ts**

```tsx
import type { Methods } from './worker.ts'

// Create WorkerProxy
const worker = createWorkerProxy<Methods>(new Worker('./worker.ts'))

// Call log-method of worker
worker.log('hello', 'bigmistqke')
```

**worker.ts**

```tsx
import { type WorkerProps, registerMethods } from '@bigmistqke/worker-proxy'

const methods = {
  log(...args: Array<string>) {
    console.log(...args)
  },
}

// Initialize worker-methods
registerMethods(methods)

// Export types of methods to infer the WorkerProxy's type
export type Methods = typeof methods
```

## $on

Subscribe to calls from WorkerProxy with `worker.$on(...)`

**main.ts**

```tsx
import type Methods from './worker.ts'

// Create WorkerProxy
const worker = createWorkerProxy<Methods>(new Worker('./worker.ts'))

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
import { type WorkerProps, registerMethods } from '@bigmistqke/worker-proxy'

// Export is only needed for types
export default registerMethods(
  (
    props: WorkerProps<{
      pong: (timestamp: number) => void
    }>,
  ) => ({
    ping(timestamp: number) {
      console.log('ping', timestamp)

      // Call .pong prop-method
      setTimeout(() => props.pong(performance.now()), 1000)
    },
  }),
)
```

## $async

Await responses of WorkerProxy-methods with `worker.$async.method(...)`

**main.ts**

```tsx
import type Methods from './worker.ts'

const worker = createWorkerProxy<Methods>(new Worker('./worker.ts'))

// Call async version of ask-method
worker.$async.ask('question').then(console.log)
```

**worker.ts**

```tsx
import { registerMethods } from '@bigmistqke/worker-proxy'

export default registerMethods({
  ask(question: string) {
    return 'Answer'
  },
})
```

## $transfer

Transfer `Transferables` to/from WorkerProxies with `$transfer(...)`

**main.ts**

```tsx
import { $transfer } from '@bigmistqke/worker-proxy'
import type Methods from './worker.ts'

const worker = createWorkerProxy<Methods>(new Worker('./worker.ts'))

const buffer = new ArrayBuffer()

// Transfer buffer to worker
worker.setBuffer($transfer(buffer, [buffer]))

// Call async version of getBuffer and log awaited results
worker.$async.getBuffer().then(console.log)
```

**worker.ts**

```tsx
import { registerMethods } from '@bigmistqke/worker-proxy'

let buffer: ArrayBuffer

export default registerMethods({
  setBuffer(_buffer: ArrayBuffer) {
    buffer = _buffer
  },
  getBuffer() {
    // Transfer buffer from worker back to main thread
    return $transfer(buffer, [buffer])
  },
})
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
import type HalloMethods from './hallo-worker.ts'
import type GoodbyeMethods from './goodbye-worker.ts'

const halloWorker = createWorkerProxy<HalloMethods>(new Worker('./hallo-worker.ts'))
const goodbyeWorker = createWorkerProxy<GoodbyeMethods>(new Worker('./goodbye-worker.ts'))

// Get a WorkerProxyPort of goodbyeWorker
const port = goodbyeWorker.$port()

// Transfer the WorkerProxyPort to halloWorker
halloWorker.link($transfer(port, [port]))

halloWorker.hallo()
```

**hallo-worker.ts**

```tsx
import {
  type WorkerProxy,
  type WorkerProxyPort,
  createWorkerProxy,
  registerMethods,
} from '@bigmistqke/worker-proxy'
import type GoodbyeMethods from './goodbye-worker'

let goodbyeWorker: WorkerProxy<GoodbyeMethods>

export default registerMethods({
  hallo() {
    console.log('hallo')
    setTimeout(() => goodbyeWorker.goodbye(), 1000)
  },
  link(port: WorkerProxyPort<typeof GoodbyeWorkerApi>) {
    // Create WorkerProxy from the given WorkerProxyPort
    goodbyeWorker = createWorkerProxy(port)
  },
})
```

**goodbye-worker.ts**

```tsx
import { registerMethods } from '@bigmistqke/worker-proxy'

export default registerMethods({
  goodbye() {
    console.log('goodbye')
  },
})
```

## Callbacks

Callbacks are automatically serialized and passed to the worker, but only when they are not embedded within an object/array.

```tsx
// ✅
worker.callback(console.log)
worker.callback('test', { id: 'user' }, console.log)

// ❌
worker.callback({ log: console.log })

// ❌
worker.callback([console.log])
```

**main.ts**

```tsx
import type Methods from './worker.ts'

const worker = createWorkerProxy<Methods>(new Worker('./worker.ts'))

worker.callback(console.log)
```

**worker.ts**

```tsx
import { registerMethods } from '@bigmistqke/worker-proxy'

export default registerMethods({
  callback(cb: (message: string) => void) {
    cb('hallo')
    setTimeout(() => cb('world'), 1000)
  },
})
```

### Manually serialize/deserialize with `$callback` and `$apply`

You can also manually serialize and deserialize with `$callback` and `$apply`. This can be handy if you prefer explicitness or if you want to pass a callback nested inside object/array.

**main.ts**

```tsx
import type Methods from './worker.ts'
import { $callback } from '@bigmistqke/worker-proxy'

const worker = createWorkerProxy<Methods>(new Worker('./worker.ts'))

worker.callback({ log: $callback(console.log) })
```

**worker.ts**

```tsx
import { $apply, type Callback, registerMethods } from '@bigmistqke/worker-proxy'

export default registerMethods({
  callback({ log }: { log: Callback<(message: string) => void> }) {
    $apply(log, 'hallo')
    setTimeout(() => $apply(log, 'hallo'), 1000)
  },
})
```
