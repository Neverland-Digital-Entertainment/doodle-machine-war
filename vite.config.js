import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  base: '/',
  plugins: [basicSsl()],
  server: {
    port: 5173,
    open: true
  },
  build: {
    target: 'esnext',
    sourcemap: false
  },
  optimizeDeps: {
    include: ['phaser']
  }
})
