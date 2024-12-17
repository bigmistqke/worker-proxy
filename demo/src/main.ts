import { createWorkerProxy } from '@bigmistqke/worker-proxy'
import type PluginMethods from './worker-methods.ts'
import type VanillaMethods from './worker-vanilla.ts'
import VanillaWorker from "./worker-vanilla.ts?worker"
import PluginWorker from "./worker.ts?worker-proxy"

async function example() {
  // Vanilla worker-proxy
  const vanillaWorker = createWorkerProxy<typeof VanillaMethods>(new VanillaWorker())
  vanillaWorker.ping(performance.now())
  
  // With vite plugin
  const pluginWorker = new PluginWorker<typeof PluginMethods>()
  pluginWorker.ping(performance.now())
}
example()
