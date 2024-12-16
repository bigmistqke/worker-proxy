import {
  $MessagePort,
  $transfer,
  createWorkerProxy,
  WorkerProps,
  WorkerProxy
} from 'vite-plugin-worker-proxy'
import type HalloWorker from './hallo'

let halloWorker: WorkerProxy<typeof HalloWorker> | null = null

export default (
  props: WorkerProps<{
    pong(timestamp: number): void
    buffer(buffer: ArrayBuffer): void
  }>
) => ({
  hallo() {
    if (!halloWorker) {
      console.error('Hallo not defined!')
    } else {
      halloWorker.hallo()
    }
  },
  ping(timestamp: number) {
    console.log('ping', timestamp)
    setTimeout(() => props.pong(performance.now()), 1000)
  },
  transferBuffer(buffer: ArrayBuffer) {
    return $transfer(buffer, [buffer])
  },
  link(hallo: $MessagePort<typeof HalloWorker>) {
    halloWorker = createWorkerProxy(hallo)
  }
})
