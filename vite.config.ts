import { defineConfig } from 'vite'
import tsconfig from 'vite-tsconfig-paths'
import workerProxyPlugin from './lib/vite-plugin-worker-proxy'

export default defineConfig({
  plugins: [workerProxyPlugin(), tsconfig()],
  worker: {
    format: 'es'
  }
})
