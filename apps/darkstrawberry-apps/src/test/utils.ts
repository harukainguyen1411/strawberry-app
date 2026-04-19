import { render } from '@testing-library/vue'
import { createPinia } from 'pinia'
import router from '@/router'
import i18n from '@/i18n'
import type { Component } from 'vue'

/**
 * Renders a Vue component with app-level providers (Pinia, Router, i18n).
 * Use for testing components that depend on useRouter, useI18n, or Pinia stores.
 */
export function renderWithProviders(
  component: Component,
  options?: Parameters<typeof render>[1]
) {
  const pinia = createPinia()
  return render(component, {
    global: {
      plugins: [pinia, router, i18n]
    },
    ...options
  })
}
