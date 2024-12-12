import type HalloWorkerApi from './hallo-worker'
import HalloWorker from './hallo-worker?werker'
import type WorkerApi from './worker'
import Worker from './worker?werker'

const worker = new Worker<typeof WorkerApi>()
const halloWorker = new HalloWorker<typeof HalloWorkerApi>()
worker.link('hallo', halloWorker)
worker.ping(performance.now())
const ab = new ArrayBuffer(1024)
worker.on.buffer(console.log)
worker.transfer(ab).buffer(ab)
