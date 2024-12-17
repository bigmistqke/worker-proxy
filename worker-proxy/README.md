# `@bigmistqke/worker-proxy`

Library to improve worker DX, similar to [ComLink](https://github.com/GoogleChromeLabs/comlink).

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
import type { Methods } from "./worker.ts"

// Create WorkerProxy
const worker = createWorkerProxy<Methods>(new Worker("./worker.ts"))

// Call log-method of worker
worker.log("hello", "bigmistqke")
```

**worker.ts**

```tsx
import { type WorkerProps, createWorkerMethods } from "@bigmistqke/worker-proxy"

const methods = {
  log(...args: Array<string>) {
    console.log(...args)
  },
}

// Initialize worker-methods
createWorkerMethods(methods)

// Export types of methods to infer the WorkerProxy's type
export type Methods = typeof methods
```

## $on

Subscribe to calls from WorkerProxy with `worker.$on(...)`

**main.ts**

```tsx
import type { Methods } from "./worker.ts"

// Create WorkerProxy
const worker = createWorkerProxy<Methods>(new Worker("./worker.ts"))

// Subscribe to .pong prop-method calls of worker
worker.$on.pong((data) => {
  console.log("pong", data)
  setTimeout(() => worker.ping(performance.now()), 1000)
})

// Call .ping-method of worker
worker.ping(performance.now())
```

**worker.ts**

```tsx
import { type WorkerProps, createWorkerMethods } from "@bigmistqke/worker-proxy"

const methods = (
  props: WorkerProps<{
    pong: (timestamp: number) => void
  }>,
) => ({
  ping(timestamp: number) {
    console.log("ping", timestamp)

    // Call .pong prop-method
    setTimeout(() => props.pong(performance.now()), 1000)
  },
})
createWorkerMethods(methods)
export type Methods = typeof methods
```

## $async

Await responses of WorkerProxy-methods with `worker.$async.method(...)`

**main.ts**

```tsx
import type { Methods } from "./worker.ts"

const worker = createWorkerProxy<Methods>(new Worker("./worker.ts"))

// Call async version of ask-method
worker.$async.ask("question").then(console.log)
```

**worker.ts**

```tsx
import { createWorkerMethods } from "@bigmistqke/worker-proxy"

const methods = {
  ask(question: string) {
    return "Answer"
  },
}
createWorkerMethods(methods)
export type Methods = typeof methods
```

## $transfer

Transfer `Transferables` to/from WorkerProxies with `$transfer(...)`

**main.ts**

```tsx
import { $transfer } from "@bigmistqke/worker-proxy"
import type { Methods } from "./worker.ts"

const worker = createWorkerProxy<Methods>(new Worker("./worker.ts"))

const buffer = new ArrayBuffer()

// Transfer buffer to worker
worker.setBuffer($transfer(buffer, [buffer]))

// Call async version of getBuffer and log awaited results
worker.$async.getBuffer().then(console.log)
```

**worker.ts**

```tsx
import { createWorkerMethods } from "@bigmistqke/worker-proxy"

let buffer: ArrayBuffer
const methods = {
  setBuffer(_buffer: ArrayBuffer) {
    buffer = _buffer
  },
  getBuffer() {
    // Transfer buffer from worker back to main thread
    return $transfer(buffer, [buffer])
  },
}
createWorkerMethods(methods)
export type Methods = typeof methods
```

## $port

Expose a WorkerProxy's API to another WorkerProxy with `worker.$port()` and `createWorkerProxy(port)`:

- `worker.$port()` returns a branded `MessagePort`:
  - `WorkerProxyPort<T> = MessagePort & { $: T }`
- `createWorkerProxy` accepts `Worker` and `WorkerProxyPort` as argument.
  - When given a `WorkerProxyPort` it infers its type from the branded type.

**main.ts**

```tsx
import { $transfer } from "@bigmistqke/worker-proxy"
import type { HalloMethods } from "./hallo-worker.ts"
import type { GoodbyeMethods } from "./goodbye-worker.ts"

const halloWorker = createWorkerProxy<HalloMethods>(
  new Worker("./hallo-worker.ts"),
)
const goodbyeWorker = createWorkerProxy<GoodbyeMethods>(
  new Worker("./goodbye-worker.ts"),
)

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
  createWorkerMethods,
} from "@bigmistqke/worker-proxy"
import type { GoodbyeMethods } from "./goodbye-worker"

let goodbyeWorker: WorkerProxy<GoodbyeMethods>

const methods = {
  hallo() {
    console.log("hallo")
    setTimeout(() => goodbyeWorker.goodbye(), 1000)
  },
  link(port: WorkerProxyPort<typeof GoodbyeWorkerApi>) {
    // Create WorkerProxy from the given WorkerProxyPort
    goodbyeWorker = createWorkerProxy(port)
  },
}
createWorkerMethods(methods)
export type HalloMethods = typeof methods
```

**goodbye-worker.ts**

```tsx
import { createWorkerMethods } from "@bigmistqke/worker-proxy"

const methods = {
  goodbye() {
    console.log("goodbye")
  },
}
createWorkerMethods(methods)
export type GoodbyeMethods = typeof methods
```
