import {
  $MessagePort,
  $transfer,
  createWorkerProxy,
  WorkerProps,
  WorkerProxy
} from 'vite-plugin-worker-proxy'
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
    // props.buffer($transfer(buffer, [buffer]))
    console.log('buffer is ', buffer)
    return $transfer(buffer, [buffer])
  },
  link(hallo: $MessagePort<typeof HalloWorker>) {
    currentHallo = createWorkerProxy(hallo)
  }
})
