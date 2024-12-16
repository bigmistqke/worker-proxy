import { defineConfig } from 'vite'
import tsconfig from 'vite-tsconfig-paths'
import werkerPlugin from './lib/vite-plugin-worker-proxy'

export default defineConfig({
  plugins: [werkerPlugin(), tsconfig()],
  worker: {
    format: 'es'
  }
})
