# `@bigmistqke/rpc`

Library to improve worker DX, similar to [ComLink](https://github.com/GoogleChromeLabs/comlink).

## Table of Contents

- [Getting Started](#getting-started)
- [Basic Example](#basic-example)
- [$transfer](#transfer) _Transfer `Transferables`_
- [$async](#async) _Await responses of worker-methods_
- [$port](#port) _Expose a WorkerProxy's api to another WorkerProxy_
- [Callbacks](#callbacks) _Serialize callbacks to workers_

## Getting Started

pnpm

```bash
pnpm add --save-dev @bigmistqke/vite-plugin-rpc
pnpm add @bigmistqke/rpc
```

npm

```bash
npm add --save-dev @bigmistqke/vite-plugin-rpc
npm add @bigmistqke/rpc
```

yarn

```bash
yarn add --dev @bigmistqke/vite-plugin-rpc
yarn add --dev @bigmistqke/rpc
```

## Basic Example

**main.ts**

```tsx
import type Methods from './worker.ts'

// Create WorkerProxy
const worker = createWorkerProxy<Methods>(new Worker('./worker.ts'))

// Call ping-method of worker
worker.ping()

// Call log-method of worker.logger
worker.logger.log('hello', 'bigmistqke')
```

**worker.ts**

```tsx
import { type WorkerProps, registerMethods } from '@bigmistqke/rpc'

class Logger {
  log(...args: Array<string>) {
    console.log(...args)
  }
}

// Initialize worker-methods with registerMethods
// Default export types of methods to infer the WorkerProxy's type
export default registerMethods({
  logger: new Logger(),
  ping() {
    console.log('ping')
  },
})
```

<details>
<summary>Only <b>paths that lead to methods</b> are available from the rpc.</summary>

All non-function values (even deeply nested ones) are stripped out from the types.

```ts
// worker.ts
export default registerMethods({
  state: 'ignore'
  nested: {
    state: 'ignore',
    ignored: {
      state: 'ignore'
    },
    method() {
      return 'not ignored'
    }
  }
})

// main.ts
import type Methods from './worker.ts'
import Worker from './worker.ts?worker'

const workerProxy = createWorkerProxy<Methods>(new Worker())
```

The resulting type of `workerProxy` will be:

```ts
{
  nested: {
    method(): string
  }
}
```

</details>

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
import { registerMethods } from '@bigmistqke/rpc'

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
import { $transfer } from '@bigmistqke/rpc'
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
import { registerMethods } from '@bigmistqke/rpc'

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
import { $transfer } from '@bigmistqke/rpc'
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
} from '@bigmistqke/rpc'
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
import { registerMethods } from '@bigmistqke/rpc'

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
import { registerMethods } from '@bigmistqke/rpc'

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
import { $callback } from '@bigmistqke/rpc'

const worker = createWorkerProxy<Methods>(new Worker('./worker.ts'))

worker.callback({ log: $callback(console.log) })
```

**worker.ts**

```tsx
import { $apply, type Callback, registerMethods } from '@bigmistqke/rpc'

export default registerMethods({
  callback({ log }: { log: Callback<(message: string) => void> }) {
    $apply(log, 'hallo')
    setTimeout(() => $apply(log, 'hallo'), 1000)
  },
})
```
