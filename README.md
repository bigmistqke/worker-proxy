# `@bigmistqke/vite-plugin-werker`

Vite plugin to improve dx with workers.

## Simple Example

**main.ts**

```tsx
import type WorkerApi from './worker'
import Worker from './worker?werker'

const worker = new Worker<typeof WorkerApi>()

async function testWorker() {
  worker.on.pong(timestamp => {
    console.log('pong', timestamp)
    setTimeout(() => worker.ping(performance.now()), 1000)
  })
  worker.ping(performance.now())
}

testWorker().catch(console.error)
```

**worker.ts**

```tsx
export default (self: { pong: (timestamp: number) => void }) => ({
  ping(timestamp: number) {
    console.log('ping', timestamp)
    setTimeout(() => self.pong(performance.now()), 1000)
  }
})
```

## Link Workers

Connect multiple workers with each other via `MessageChannel`.

**main.ts**

```tsx
import HalloWorker from './hallo-worker?werker'
import type HalloWorkerApi from './hallo-worker'
import GoodbyeWorker from './goodbye-worker?werker'
import type GoodbyeWorkerApi from './goodbye-worker'

const halloWorker = new HalloWorker<typeof HalloWorkerApi>()
const goodbyeWorker = new GoodbyeWorker<typeof GoodbyeWorkerApi>()
halloWorker.link('goodbye', goodbyeWorker)
halloWorker.hallo()
```

**hallo-worker.ts**

```tsx
export default (self, channels: { goodbye: { goodbye: () => void } }) => ({
  hallo() {
    console.log('hallo')
    setTimeout(() => channels.goodbye.goodbye(), 1000)
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

## Roadmap

- [ ] Transferables
- [x] Linking multiple workers to each other (via MessageChannel)
