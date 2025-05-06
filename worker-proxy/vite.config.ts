import { defineConfig } from 'vite'
import tsconfig from 'vite-tsconfig-paths'

export default defineConfig({
  base: './',
  plugins: [tsconfig()],
  worker: {
    format: 'es',
  },
})
