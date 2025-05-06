import { expose } from 'src'

const methods = {
  ping(timestamp: number) {
    console.log('ping from vanilla-worker', timestamp)
    return 'pinged!'
  },
}

expose(methods)

export type WorkerGlobalMethods = typeof methods
