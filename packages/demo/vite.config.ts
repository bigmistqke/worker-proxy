import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import path from 'path'

const rpcProxy = path.resolve(__dirname, '../rpc-proxy/src')

const aliases = [
  { find: '@bigmistqke/rpc/messenger', replacement: path.join(rpcProxy, 'messenger.ts') },
  { find: '@bigmistqke/rpc/stream', replacement: path.join(rpcProxy, 'stream/index.ts') },
  { find: '@bigmistqke/rpc/fetch', replacement: path.join(rpcProxy, 'fetch/index.ts') },
  { find: '@bigmistqke/rpc/server-send-events', replacement: path.join(rpcProxy, 'server-send-events/index.ts') },
]

export default defineConfig({
  plugins: [solid()],
  build: {
    target: 'esnext',
  },
  worker: {
    format: 'es',
    plugins: () => [solid()],
  },
  resolve: {
    alias: aliases,
  },
})
