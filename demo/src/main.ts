// Vanilla worker-proxy
import { $callback, $transfer, createWorkerProxy } from '@bigmistqke/worker-proxy'
import type VanillaMethods from './worker-vanilla.ts'
import VanillaWorker from "./worker-vanilla.ts?worker"

const vanillaWorker = createWorkerProxy<typeof VanillaMethods>(new VanillaWorker())
vanillaWorker.ping(performance.now())
const buffer1 = new ArrayBuffer()

vanillaWorker.transfer($transfer(buffer1, [buffer1]))

// With vite-plugin
import type PluginMethods from './worker-plugin.ts'
import PluginWorker from "./worker-plugin.ts?worker-proxy"

const pluginWorker = new PluginWorker<typeof PluginMethods>()
pluginWorker.ping(performance.now())

const buffer = new ArrayBuffer()


pluginWorker.transfer($transfer(buffer, [buffer]))

setInterval(async () => {
  const cb = $callback((value: string) => console.log(value))
  await pluginWorker.$async.callback(cb)
}, 500)
