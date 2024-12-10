import type HalloWorkerApi from './hallo-worker'
import HalloWorker from './hallo-worker?werker'
import type WorkerApi from './worker'
import Worker from './worker?werker'

async function testWorker() {
  const worker = new Worker<typeof WorkerApi>()
  const halloWorker = new HalloWorker<typeof HalloWorkerApi>()
  worker.link('hallo', halloWorker)
  worker.ping(performance.now())
}

testWorker().catch(console.error)
