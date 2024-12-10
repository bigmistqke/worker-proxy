export default ({ pong }: { pong: (timestamp: number) => void }) => ({
  ping(timestamp: number) {
    console.log('ping', timestamp)
    setTimeout(() => pong(performance.now()), 1000)
  }
})
