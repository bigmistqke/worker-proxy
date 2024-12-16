import { WerkerProps } from '../lib/types'
import type halloWorker from './hallo'

export default ({
  self,
  hallo
}: WerkerProps<{
  self: { pong(timestamp: number): void; buffer(buffer: ArrayBuffer): void }
  hallo: ReturnType<typeof halloWorker>
}>) => ({
  ping(timestamp: number) {
    console.log('ping', timestamp)
    hallo?.hallo()
    // setTimeout(() => self.pong(performance.now()), 1000)
  },
  buffer(buffer: ArrayBuffer) {
    console.log(buffer)
    self.$transfer(buffer).buffer(buffer)
    return true
  }
})
