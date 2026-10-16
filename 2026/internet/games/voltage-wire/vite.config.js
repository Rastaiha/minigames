import {defineConfig} from 'vite'
import {fileURLToPath} from 'node:url'

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        hub: fileURLToPath(new URL('./index.html', import.meta.url)),
        voltage: fileURLToPath(new URL('./voltage/index.html', import.meta.url)),
        bandwidth: fileURLToPath(new URL('./bandwidth/index.html', import.meta.url)),
      },
    },
  },
})
