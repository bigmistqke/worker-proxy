import { expose } from 'src'

const methods = {
  ping(timestamp: number) {
    console.log('ping from vanilla-worker', timestamp)
    return 'pinged!'
  },
}

const channel = new MessageChannel()
expose(methods, channel.port2)

self.postMessage(channel.port1, [channel.port1])

export type WorkerPortMethods = typeof methods
