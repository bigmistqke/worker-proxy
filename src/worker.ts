import { $MessagePort, createWorkerProxy, WorkerProps, WorkerProxy } from 'vite-plugin-worker-proxy'
import type HalloWorker from './hallo'

let currentHallo: WorkerProxy<typeof HalloWorker>

export default (
  props: WorkerProps<{ pong(timestamp: number): void; buffer(buffer: ArrayBuffer): void }>
) => ({
  ping(timestamp: number) {
    console.log('ping', timestamp)
    if (currentHallo) {
      currentHallo.hallo()
    }
    setTimeout(() => props.pong(performance.now()), 1000)
  },
  transferBuffer(buffer: ArrayBuffer) {
    props.$transfer.buffer(buffer, [buffer])
    return true
  },
  link(hallo: $MessagePort<typeof HalloWorker>) {
    currentHallo = createWorkerProxy(hallo)
  }
})
