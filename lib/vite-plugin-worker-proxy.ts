import { promises as fs } from 'fs'
import { basename, extname, resolve } from 'path'
import type { Plugin } from 'vite'
import { generateClientSource, generateWorkerSource } from './source'

export default (): Plugin => {
  let isDev: boolean

  return {
    name: 'werker-transform', // Plugin name for warnings and errors

    config(_, { command }) {
      // Detect the mode based on the command
      isDev = command === 'serve' // 'serve' for dev, 'build' for production
    },

    async load(id) {
      if (isDev) {
        if (id.endsWith('?worker_file&type=module')) {
          const originalPath = id.replace('?worker_file&type=module', '')
          // Return the wrapped worker source
          return generateWorkerSource(originalPath)
        } else if (id.endsWith('?worker-proxy')) {
          const path = id.replace('?worker-proxy', '')
          return generateClientSource(`${path}?worker_file&type=module`)
        }
      } else {
        if (id.endsWith('?worker-proxy')) {
          const path = id.replace('?worker-proxy', '')
          const name = basename(path, extname(path))

          const workerName = `${name}.worker-proxy.js`
          const workerPath = resolve(path.split('/').slice(0, -1).join('/'), `./${workerName}`)

          // Make temporary worker-file
          // NOTE: Should we do a check if a file with this name already exists?
          await fs.writeFile(workerPath, generateWorkerSource(`./${name}`))

          // Make chunk of worker-file
          this.emitFile({
            type: 'chunk',
            fileName: `assets/${workerName}`,
            id: workerPath
          })

          // Remove temporary worker-file
          await fs.rm(workerPath, { force: true })

          // Return client-side proxy pointing to bundled worker
          return generateClientSource(`./assets/${name}.worker-proxy.js`)
        }
      }
    }
  }
}
