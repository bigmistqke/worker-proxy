import { registerMethods } from "@bigmistqke/worker-proxy";

export default registerMethods({
  ping(timestamp: number) {
    console.log('ping', timestamp)
  },
})