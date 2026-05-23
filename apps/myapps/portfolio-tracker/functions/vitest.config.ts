import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // tsc emits compiled test files into lib/; vitest only runs source .ts.
    exclude: ['**/node_modules/**', 'lib/**'],
  },
})
