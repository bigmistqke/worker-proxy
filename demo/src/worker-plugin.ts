import { $apply, $Callback } from "@bigmistqke/worker-proxy"

class Logger {
  state = "ignore"
  log(message: string){
    console.log(message)
  }
  test = {
    state: 'ignore',
    another:  {
      state: 'ignore'
    },
    hello(){
      return "world" as const
    }
  }
}

export default {
  logger: new Logger(),
  ping(timestamp: number) {
    console.log('ping from worker-plugin', timestamp)
  },
  callback(cb: (message: string) => void){
    cb('hallo')
  },
  nestedCallback({cb}: {cb: $Callback<(message: string) => void>}){
    $apply(cb, 'hallo')
  },
  transfer(buffer: ArrayBuffer){
    console.log('transferred to worker-plugin', buffer)
  }
}
