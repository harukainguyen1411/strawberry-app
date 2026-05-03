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
    // Vitest globs unit tests under src/ and functions source. Excludes:
    //   test/rules/** + test/emulator/** — Jest + @firebase/rules-unit-testing, not Vitest
    //   e2e/**                            — Playwright, not Vitest
    //   functions/lib/**                  — compiled output (gitignored), source lives in functions/__tests__/
    exclude: [
      '**/test/rules/**',
      '**/test/emulator/**',
      '**/e2e/**',
      '**/functions/lib/**',
      '**/node_modules/**',
    ],
  }
})
