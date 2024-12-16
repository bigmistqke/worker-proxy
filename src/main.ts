import { $transfer } from 'vite-plugin-worker-proxy/source.ts'
import HalloWorkerApi from './hallo.ts'
import HalloWorker from './hallo.ts?worker-proxy'
import WorkerApi from './worker.ts'
import Worker from './worker.ts?worker-proxy'

async function example() {
  // Create WorkerProxies
  const worker = new Worker<typeof WorkerApi>()
  const halloWorker = new HalloWorker<typeof HalloWorkerApi>()

  worker.hallo()

  // Get branded MessagePort of halloWorker, giving access to halloWorker's api
  const port = halloWorker.$port()
  // Transfer MessagePort to worker
  worker.link(port, $transfer(port))

  worker.hallo()

  // Subscribe to pong-calls of worker
  worker.$on.pong(data => console.log('pong', data))

  // Call ping-method of worker
  worker.ping(performance.now())

  const ab = new ArrayBuffer(1024)
  try {
    // Call an async version of `transferBuffer` and transfer the arrayBuffer
    const result = await worker.$async.transferBuffer(ab, $transfer(ab))
    console.log('result of buffer is:', result)
  } catch (error) {
    console.error(error)
  }
}
example()
