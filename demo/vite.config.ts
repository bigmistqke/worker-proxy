import workerProxyPlugin from '@bigmistqke/vite-plugin-worker-proxy'
import { defineConfig } from 'vite'
import tsconfig from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [workerProxyPlugin(), tsconfig()],
  worker: {
    format: 'es'
  }
})
