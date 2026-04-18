/// <reference types="vitest" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'

// Read package.json to get default version
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))
// Allow version to be overridden via environment variable (for versioned deployments)
const appVersion = process.env.VITE_APP_VERSION || packageJson.version || '1.0.0'
const releaseTime = process.env.VITE_RELEASE_TIME || new Date().toISOString()
// Release notes from GitHub release (if available)
const releaseNotes = process.env.VITE_RELEASE_NOTES || ''

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
    'import.meta.env.VITE_RELEASE_TIME': JSON.stringify(releaseTime),
    'import.meta.env.VITE_RELEASE_NOTES': JSON.stringify(releaseNotes)
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../../shared', import.meta.url))
    },
    dedupe: ['firebase', 'vue', 'vue-router', 'pinia']
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'chart-vendor': ['chart.js', 'vue-chartjs']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx,vue}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/', '**/*.d.ts', '**/*.config.*']
    }
  }
})

