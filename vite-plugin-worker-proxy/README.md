# `@bigmistqke/vite-plugin-worker-proxy`

Vite plugin integration of `@bigmistqke/worker-proxy`, automatically wrapping the default exports of `*?worker-proxy` files in a `WorkerProxy`.

## Table of Contents

- [Getting Started](#getting-started)
- [Basic Example](#basic-example)
- [$transfer](#transfer) _Transfer `Transferables`_
- [$async](#async) _Await responses of worker-methods_
- [$port](#port) _Expose a WorkerProxy's api to another WorkerProxy_
- [Callbacks](#callbacks) _Serialize callbacks to workers_

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

// Call ping-method of worker
worker.ping()

// Call log-method of worker.logger
worker.logger.log('hello', 'bigmistqke')
```

**worker.ts**

```tsx
class Logger {
  log(...args: Array<string>) {
    console.log(...args)
  }
}

// Default export the methods you want to expose.
export default {
  logger: new Logger(),
  ping() {
    console.log('ping')
  }
}
```

<details>
<summary>Only <b>paths that lead to methods</b> are available from the worker-proxy.</summary>

All non-function values (even deeply nested ones) are stripped out from the types.

```ts
// worker.ts
export default {
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
}

// main.ts
import type Logger from './worker.ts'
import Worker from './worker.ts?worker-proxy'

const workerProxy = new Worker<Logger>()
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
import Worker from './worker?worker-proxy'
import type WorkerMethods from './worker'

const worker = new Worker<typeof WorkerMethods>()

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
import type WorkerMethods from './worker'

const worker = new Worker<typeof WorkerMethods>()

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
import type HalloMethods from './hallo-worker'
import GoodbyeWorker from './goodbye-worker?worker-proxy'
import type GoodbyeMethods from './goodbye-worker'

const halloWorker = new HalloWorker<typeof HalloMethods>()
const goodbyeWorker = new GoodbyeWorker<typeof GoodbyeMethods>()

// Get a WorkerProxyPort of goodbyeWorker
const port = goodbyeWorker.$port()

// Transfer the WorkerProxyPort to halloWorker
halloWorker.link($transfer(port, [port]))

halloWorker.hallo()
```

**hallo-worker.ts**

```tsx
import { type WorkerProxy, type WorkerProxyPort, createWorkerProxy } from '@bigmistqke/worker-proxy'
import type GoodbyeMethods from './goodbye-worker'

let goodbyeWorker: WorkerProxy<typeof GoodbyeMethods>

export default {
  hallo() {
    console.log('hallo')
    setTimeout(() => goodbyeWorker.goodbye(), 1000)
  },
  link(port: WorkerProxyPort<typeof GoodbyeMethods>) {
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

## Callbacks

Callbacks are serialized and passed to the worker, but only when they are not embedded within objects or arrays.

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
import Worker from './worker.ts?worker-proxy'

const worker = new Worker<typeof Methods>()

worker.callback(console.log)
```

**worker.ts**

```tsx
export default {
  callback(cb: (message: string) => void) {
    cb('hallo')
    setTimeout(() => cb('world'), 1000)
  }
}
```

### Manually serialize/deserialize with `$callback` and `$apply`

You can also manually serialize and deserialize with `$callback` and `$apply`. This can be handy if you prefer explicitness or if you want to pass a callback nested inside object/array.

**main.ts**

```tsx
import type Methods from './worker.ts'
import { $callback } from '@bigmistqke/worker-proxy'

const worker = new Worker<typeof Methods>()

worker.callback({ log: $callback(console.log) })
```

**worker.ts**

```tsx
import { $apply, type Callback } from '@bigmistqke/worker-proxy'

export default {
  callback({ log }: { log: Callback<(message: string) => void> }) {
    $apply(log, 'hallo')
    setTimeout(() => $apply(log, 'hallo'), 1000)
  }
}
```
