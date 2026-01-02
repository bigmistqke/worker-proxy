import { expose } from '../../../rpc-proxy/src/messenger'

// Define methods to expose to the main thread
const methods = {
  greet(name: string) {
    return `Hello, ${name}!`
  },

  add(a: number, b: number) {
    return a + b
  },

  multiply(a: number, b: number) {
    return a * b
  },

  async fetchData(url: string) {
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 500))
    return { url, timestamp: Date.now(), data: 'Fetched data from worker' }
  },

  math: {
    square(n: number) {
      return n * n
    },
    factorial(n: number): number {
      if (n <= 1) return 1
      return n * methods.math.factorial(n - 1)
    },
  },

  slowOperation(ms: number) {
    return new Promise<string>(resolve => {
      setTimeout(() => resolve(`Completed after ${ms}ms`), ms)
    })
  },
}

// Expose methods to the main thread
expose(methods)

export type WorkerMethods = typeof methods
