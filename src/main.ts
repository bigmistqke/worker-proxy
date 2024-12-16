import HalloWorkerApi from './hallo.ts'
import HalloWorker from './hallo.ts?worker-proxy'
import WorkerApi from './worker.ts'
import Worker from './worker.ts?worker-proxy'

const worker = new Worker<typeof WorkerApi>()
const halloWorker = new HalloWorker<typeof HalloWorkerApi>()
worker.$link('hallo', halloWorker)
worker.ping(performance.now())
worker.$on.pong(data => console.log('pong', data))

const buffer = new ArrayBuffer(1024)
worker.$transfer.$async.buffer(buffer, [buffer]).then(result => console.log('result:', result))
