import type WorkerApi from './worker'
import Worker from './worker?werker'

const worker = new Worker<typeof WorkerApi>()

async function testWorker() {
  worker.on.pong(timestamp => {
    console.log('pong', timestamp)
    setTimeout(() => worker.ping(performance.now()), 1000)
  })
  worker.ping(performance.now())
}

testWorker().catch(console.error)
