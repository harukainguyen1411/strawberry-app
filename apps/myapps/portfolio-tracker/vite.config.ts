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
    // Vitest globs unit tests under src/. Excludes:
    //   test/rules/** + test/emulator/** — Jest + @firebase/rules-unit-testing, not Vitest
    //   e2e/**                            — Playwright, not Vitest
    //   functions/**                      — has its own vitest runner at functions/vitest.config.ts;
    //                                       functions deps (e.g. pdf-parse) live only in functions/package.json,
    //                                       and CI per-workspace install does not hoist, so pulling functions
    //                                       tests into the app's vitest scope would fail to resolve them.
    exclude: [
      '**/test/rules/**',
      '**/test/emulator/**',
      '**/e2e/**',
      '**/functions/**',
      '**/node_modules/**',
    ],
  }
})
