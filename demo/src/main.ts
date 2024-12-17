import { createWorkerProxy } from '@bigmistqke/worker-proxy'

// Vanilla worker-proxy
import type VanillaMethods from './worker-vanilla.ts'
import VanillaWorker from "./worker-vanilla.ts?worker"

const vanillaWorker = createWorkerProxy<typeof VanillaMethods>(new VanillaWorker())
vanillaWorker.ping(performance.now())

// With vite-plugin
import type PluginMethods from './worker-methods.ts'
import PluginWorker from "./worker-methods.ts?worker-proxy"

const pluginWorker = new PluginWorker<typeof PluginMethods>()
pluginWorker.ping(performance.now())
