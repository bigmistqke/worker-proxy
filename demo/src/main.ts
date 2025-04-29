/**********************************************************************************/
/*                                                                                */
/*                                 Vanilla Worker                                 */
/*                                                                                */
/**********************************************************************************/

import { $callback, $transfer, createWorkerProxy } from '../../worker-proxy/src'
import type VanillaMethods from './worker-vanilla.ts'
import VanillaWorker from "./worker-vanilla.ts?worker"

const vanillaWorker = createWorkerProxy<typeof VanillaMethods>(new VanillaWorker())

vanillaWorker.ping(performance.now())

const buffer1 = new ArrayBuffer()
vanillaWorker.transfer($transfer(buffer1, [buffer1]))

vanillaWorker.logger.log('hello from vanilla worker')
vanillaWorker.logger.test.hello.$().then((world) => console.log('vanilla worker async method', world))

vanillaWorker.callback((value) => console.log('callback from vanilla-worker', value))
vanillaWorker.nestedCallback({cb: $callback((value: string) => console.log('nested callback from vanilla-worker', value))})


/**********************************************************************************/
/*                                                                                */
/*                                With Vite Plugin                                */
/*                                                                                */
/**********************************************************************************/

import type PluginMethods from './worker-plugin.ts'
import PluginWorker from "./worker-plugin.ts?worker-proxy"

const pluginWorker = new PluginWorker<typeof PluginMethods>()

pluginWorker.ping(performance.now())

const buffer = new ArrayBuffer()
pluginWorker.transfer($transfer(buffer, [buffer]))

pluginWorker.logger.log('hello from plugin worker')
pluginWorker.logger.test.hello.$().then((world) => console.log('plugin worker async method', world))

pluginWorker.callback((value) => console.log('callback from plugin-worker', value))
pluginWorker.nestedCallback({cb: $callback((value: string) => console.log('nested callback from plugin-worker', value))})




