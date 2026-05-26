import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

export default defineConfigWithVueTs(
  { ignores: ['dist', 'dist-shell', 'dist-pt', 'dist-ssr', 'node_modules', 'coverage', '**/e2e/**', '**/*.config.js', '**/*.config.ts', 'playwright.config.ts', 'functions/lib', '**/functions/lib/**'] },
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',
      'prefer-const': 'warn'
    }
  }
)
