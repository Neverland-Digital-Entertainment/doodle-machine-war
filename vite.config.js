import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  base: './',
  plugins: [basicSsl(), viteSingleFile()],
  server: {
    port: 5173,
    open: true
  },
  build: {
    target: 'esnext',
    sourcemap: false,
    assetsInlineLimit: 100000000, // inline all assets
    chunkSizeWarningLimit: 100000000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      }
    }
  },
  optimizeDeps: {
    include: ['phaser']
  }
})
