import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  base: 'rpc',
  plugins: [solid()],
  build: {
    target: 'esnext',
  },
  worker: {
    format: 'es',
    plugins: () => [solid()],
  },
})
