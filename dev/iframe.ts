import { expose, rpc } from 'src/messenger'
import type { MainMethods } from './main'

const methods = {
  ping(timestamp: number) {
    console.log('ping from iframe', timestamp)
    return 'pinged!'
  },
}

expose(methods)

type IframeMethods = typeof methods

export type { IframeMethods }

const proxy = rpc<MainMethods>(self.parent)
proxy.ping(performance.now())
