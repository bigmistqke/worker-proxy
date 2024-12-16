import virtual from '@rollup/plugin-virtual'
import path from 'path'
import { rollup } from 'rollup'
import type { Plugin } from 'vite'
import { build } from 'vite'
import { getClientSource, getWorkerSource } from './source'

export default (): Plugin => {
  let isDev: boolean

  return {
    name: 'werker-transform', // Plugin name for warnings and errors

    config(_, { command }) {
      // Detect the mode based on the command
      isDev = command === 'serve' // 'serve' for dev, 'build' for production
    },

    async load(id) {
      if (id.endsWith('?worker_file&type=module')) {
        const originalPath = id.replace('?worker_file&type=module', '')

        // Return the wrapped worker source
        return getWorkerSource(originalPath)
      }

      if (id.endsWith('?worker-proxy')) {
        const originalPath = id.replace('?worker-proxy', '')
        const fileName = path.basename(originalPath, path.extname(originalPath))

        if (!isDev) {
          // Production: Bundle worker file into standalone package
          const bundledWorkerPath = path.resolve('dist', 'assets', `${fileName}.worker.js`)

          const clientFileName = `${fileName}.worker-file.js`

          const result = await build({
            build: {
              lib: {
                entry: originalPath,
                formats: ['es'],
                fileName: clientFileName
              },
              outDir: path.dirname(bundledWorkerPath),
              rollupOptions: {
                output: {
                  inlineDynamicImports: true // Ensures all imports are bundled
                }
              }
            }
          })

          // @ts-ignore
          const source = result[0].output[0].code

          // Use the virtual plugin to define files in memory
          const virtualPlugin = virtual({
            [fileName]: source,
            [`${fileName}.worker.js`]: getWorkerSource(`./${fileName}`)
          })

          const bundle = await rollup({ input: `${fileName}.worker.js`, plugins: [virtualPlugin] })

          // Generate output
          const { output } = await bundle.generate({
            format: 'esm'
          })

          let code = ''

          // Write bundled output to a file or display it
          for (const chunkOrAsset of output) {
            if (chunkOrAsset.type === 'chunk') {
              code += chunkOrAsset.code
            }
          }

          // Close the bundle
          await bundle.close()

          this.emitFile({
            type: 'asset',
            fileName: `assets/${fileName}.worker.js`,
            source: code
          })

          // Return client-side proxy pointing to bundled worker
          return getClientSource(`./assets/${fileName}.worker.js`)
        }

        // Development: Directly load worker dynamically
        return getClientSource(`${originalPath}?worker_file&type=module`)
      }
    }
  }
}
