import { type $Callback, $apply } from "@bigmistqke/worker-proxy"
export default {
  ping(timestamp: number) {
    console.log('ping', timestamp)
  },
  callback(cb: $Callback<(message: string) => void>){
    $apply(cb, "hallo")
  },
  transfer(buffer: ArrayBuffer){
    console.log(buffer)
  }
}
