import type halloWorker from './hallo-worker'

export default (
  self: { pong: (timestamp: number) => void },
  channels: { hallo: ReturnType<typeof halloWorker> }
) => ({
  ping(timestamp: number) {
    console.log('ping', timestamp)
    channels.hallo.hallo()
    setTimeout(() => self.pong(performance.now()), 1000)
  }
})
