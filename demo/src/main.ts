// Vanilla worker-proxy
import { $callback, $transfer, createWorkerProxy } from '@bigmistqke/worker-proxy'
import type VanillaMethods from './worker-vanilla.ts'
import VanillaWorker from "./worker-vanilla.ts?worker"

const vanillaWorker = createWorkerProxy<typeof VanillaMethods>(new VanillaWorker())
vanillaWorker.ping(performance.now())
const buffer1 = new ArrayBuffer()

vanillaWorker.transfer($transfer(buffer1, [buffer1]))
vanillaWorker.logger.log('hello from vanilla worker')
vanillaWorker.logger.test.$async.hello().then((world) => console.log('vanilla worker async method', world))

// With vite-plugin
import type PluginMethods from './worker-plugin.ts'
import PluginWorker from "./worker-plugin.ts?worker-proxy"

const pluginWorker = new PluginWorker<typeof PluginMethods>()
pluginWorker.ping(performance.now())

const buffer = new ArrayBuffer()
pluginWorker.transfer($transfer(buffer, [buffer]))

pluginWorker.plugins[0].log('hello from plugin worker')
pluginWorker.plugins[0].test.$async.hello().then((world) => console.log('plugin worker async method', world))

setInterval(async () => {
  const cb = $callback((value: string) => console.log('ping', value))
  await pluginWorker.$async.callback(cb)
}, 500)




