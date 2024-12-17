import {
  $transfer,
  createWorkerProxy,
  type WorkerProps,
  type WorkerProxy,
  type WorkerProxyPort
} from '@bigmistqke/worker-proxy';
import type HalloWorker from './hallo';

let currentHallo: WorkerProxy<typeof HalloWorker>

export default (
  props: WorkerProps<{ pong(timestamp: number): void; }>
) => ({
  ping(timestamp: number) {
    console.log('ping', timestamp)
    if (currentHallo) {
      currentHallo.hallo()
    }
    setTimeout(() => props.pong(performance.now()), 1000)
  },
  transferBuffer(buffer: ArrayBuffer) {
    console.log('buffer is ', buffer)
    return $transfer(buffer, [buffer])
  },
  link(hallo: WorkerProxyPort<typeof HalloWorker>) {
    // @ts-ignore
    currentHallo = createWorkerProxy(hallo)
  }
})
