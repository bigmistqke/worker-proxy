import WorkerApi from './worker.ts'
import Worker from './worker.ts?worker-proxy'

async function example() {
  // Create WorkerProxies
  const worker = new Worker<typeof WorkerApi>()

  // Call ping-method of worker
  worker.ping(performance.now())
}
example()
