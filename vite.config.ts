import { defineConfig } from 'vite'
import werkerPlugin from './lib/vite-plugin-werker'

export default defineConfig({
  plugins: [werkerPlugin()],
  worker: {
    format: 'es'
  }
})
