import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/rules/**/*.test.ts', '**/emulator/**/*.test.ts'],
}

export default config
