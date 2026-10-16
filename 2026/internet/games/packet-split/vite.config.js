import {resolve} from 'node:path'
import {defineConfig} from 'vite'

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        home:      resolve(import.meta.dirname, 'index.html'),
        withSplit: resolve(import.meta.dirname, 'with-split/index.html'),
        withOverhead: resolve(import.meta.dirname, 'with-overhead/index.html'),
        noSplit:   resolve(import.meta.dirname, 'no-split/index.html'),
      },
    },
  },
})
