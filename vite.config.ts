import { defineConfig } from 'vite'
import mkcert from 'vite-plugin-mkcert'
import tsconfig from 'vite-tsconfig-paths'

export default defineConfig({
  base: './',
  plugins: [tsconfig(), mkcert()],
  worker: {
    format: 'es',
  },
})
