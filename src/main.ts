import HalloWorkerApi from './hallo.ts'
import HalloWorker from './hallo.ts?werker'
import WorkerApi from './worker.ts'
import Worker from './worker.ts?werker'

const worker = new Worker<typeof WorkerApi>()
const halloWorker = new HalloWorker<typeof HalloWorkerApi>()
worker.$link('hallo', halloWorker)
worker.ping(performance.now())

console.log('Hallo', worker, halloWorker)

const buffer = new ArrayBuffer(1024)
worker
  .$transfer(buffer)
  .$async.buffer(buffer)
  .then(boolean => console.log('buffer', boolean))
