import { $apply, $Callback, registerMethods } from '@bigmistqke/worker-proxy'
class Logger {
  state = "ignore"
  log(message: string){
    console.log(message)
  }
  test = {
    state: 'ignore',
    more:  {
      state: 'ignore'
    },
    hello(){
      return "world" as const
    }
  }
}

const logger = new Logger()

export default registerMethods({
  logger,
  callback(cb: (value: string) => void){
    cb("hallo")
  },
  nestedCallback({cb}: {cb: $Callback<(message: string) => void>}){
    $apply(cb, 'hallo')
  },
  ping(timestamp: number) {
    console.log('ping from vanilla-worker', timestamp)
  },
  transfer(buffer: ArrayBuffer){
    console.log('transferred to vanilla-worker', buffer)
  }
})