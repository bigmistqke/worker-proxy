# `@bigmistqke/vite-plugin-werker`

Vite plugin to improve dx with workers.

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

## Roadmap

- [ ] Transferables
- [ ] Piping multiple workers to each other (via MessageChannel)
