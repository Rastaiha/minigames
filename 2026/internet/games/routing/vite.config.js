import {resolve} from 'node:path'
import {defineConfig} from 'vite'

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        basic: resolve(import.meta.dirname, 'basic/index.html'),
        aggregate: resolve(import.meta.dirname, 'aggregate/index.html'),
      },
    },
  },
})
