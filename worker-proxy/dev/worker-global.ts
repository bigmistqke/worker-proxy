import { expose } from 'src/messenger'

const methods = {
  ping(timestamp: number) {
    console.log('ping from vanilla-worker', timestamp)
    return 'pinged!'
  },
}

expose(methods)

export type WorkerGlobalMethods = typeof methods
