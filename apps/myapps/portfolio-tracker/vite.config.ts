/// <reference types="vitest" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  base: '/myApps/portfolio-tracker/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../../shared', import.meta.url)),
    },
    dedupe: ['firebase', 'vue', 'vue-router', 'pinia'],
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/vue') || id.includes('node_modules/pinia') || id.includes('node_modules/@vue')) {
            return 'vue-vendor'
          }
          if (id.includes('node_modules/firebase')) {
            return 'firebase-vendor'
          }
        },
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // Exclude rules tests — those use @firebase/rules-unit-testing + Jest, not Vitest
    exclude: ['**/test/rules/**', '**/node_modules/**'],
  }
})
