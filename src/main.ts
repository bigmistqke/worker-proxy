import HalloWorkerApi from './hallo.ts'
import HalloWorker from './hallo.ts?worker-proxy'
import WorkerApi from './worker.ts'
import Worker from './worker.ts?worker-proxy'

async function example() {
  // Create WorkerProxies
  const worker = new Worker<typeof WorkerApi>()
  const halloWorker = new HalloWorker<typeof HalloWorkerApi>()

  // Get branded MessagePort of halloWorker, giving access to halloWorker
  const port = halloWorker.$port()

  // Transfer MessagePort to worker
  worker.$transfer.link(port, [port])

  // Subscribe to pong-calls of worker
  worker.$on.pong(data => console.log('pong', data))

  // Call ping-method of worker
  worker.ping(performance.now())

  const ab = new ArrayBuffer(1024)
  try {
    // Call an async version of `transferBuffer` and transfer the arrayBuffer
    const result = await worker.$transfer.$async.transferBuffer(ab, [ab])
    console.log('result of buffer is:', result)
  } catch (error) {
    console.error(error)
  }
}
example()
