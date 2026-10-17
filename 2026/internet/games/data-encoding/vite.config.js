import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        voltage: resolve(import.meta.dirname, 'voltage/index.html'),
        manchester: resolve(import.meta.dirname, 'manchester/index.html'),
        timer: resolve(import.meta.dirname, 'timer/index.html'),
      },
    },
  },
})
