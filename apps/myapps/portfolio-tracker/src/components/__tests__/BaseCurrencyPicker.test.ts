/**
 * A.11 — BaseCurrencyPicker component tests (Refs V0.10)
 *
 * xfail-first: all tests use it.fails() until implementation lands.
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref, computed } from 'vue'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ path: '/', meta: {} }),
  RouterView: defineComponent({ render: () => h('div') }),
  RouterLink: defineComponent({ props: ['to'], render() { return h('a', {}, this.$slots.default?.()) } }),
  createRouter: vi.fn(),
  createWebHistory: vi.fn(),
}))

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    email: computed(() => 'duong@allowed.test'),
    uid: computed(() => 'user123'),
    isAuthenticated: computed(() => true),
  }),
}))

vi.mock('@/composables/useBaseCurrency', () => ({
  useBaseCurrency: () => ({
    baseCurrency: ref(null),
    setBaseCurrency: vi.fn().mockResolvedValue(undefined),
    loading: ref(false),
  }),
}))

describe('A.11 — BaseCurrencyPicker', () => {
  it.fails('A.11.1 Continue button is disabled on mount (no radio selected)', async () => {
    const BaseCurrencyPicker = (await import('@/components/BaseCurrencyPicker.vue')).default
    const wrapper = mount(BaseCurrencyPicker)
    const btn = wrapper.find('button[data-testid="continue-btn"]')
    expect(btn.exists()).toBe(true)
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it.fails('A.11.2 clicking USD radio enables Continue and sets aria-checked', async () => {
    const BaseCurrencyPicker = (await import('@/components/BaseCurrencyPicker.vue')).default
    const wrapper = mount(BaseCurrencyPicker)
    await wrapper.find('input[value="USD"]').trigger('change')
    const btn = wrapper.find('button[data-testid="continue-btn"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(false)
    const usdLabel = wrapper.find('[data-testid="radio-USD"]')
    expect(usdLabel.attributes('aria-checked')).toBe('true')
  })

  it.fails('A.11.3 Escape key does not close the modal', async () => {
    const BaseCurrencyPicker = (await import('@/components/BaseCurrencyPicker.vue')).default
    const wrapper = mount(BaseCurrencyPicker)
    await wrapper.trigger('keydown', { key: 'Escape' })
    // Modal should still be in DOM
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
  })

  it.fails('A.11.4 clicking backdrop does not close modal', async () => {
    const BaseCurrencyPicker = (await import('@/components/BaseCurrencyPicker.vue')).default
    const wrapper = mount(BaseCurrencyPicker)
    const backdrop = wrapper.find('[data-testid="modal-backdrop"]')
    if (backdrop.exists()) {
      await backdrop.trigger('click')
    }
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
  })

  it.fails('A.11.5 clicking Continue with USD selected emits confirm with "USD"', async () => {
    const BaseCurrencyPicker = (await import('@/components/BaseCurrencyPicker.vue')).default
    const wrapper = mount(BaseCurrencyPicker)
    await wrapper.find('input[value="USD"]').trigger('change')
    await wrapper.find('button[data-testid="continue-btn"]').trigger('click')
    expect(wrapper.emitted('confirm')).toBeTruthy()
    expect(wrapper.emitted('confirm')?.[0]).toEqual(['USD'])
  })

  it.fails('A.11.6 guard: modal renders over DashboardView when baseCurrency unset', async () => {
    // Mock useBaseCurrency with unset baseCurrency
    vi.doMock('@/composables/useBaseCurrency', () => ({
      useBaseCurrency: () => ({
        baseCurrency: ref(null),
        setBaseCurrency: vi.fn(),
        loading: ref(false),
      }),
    }))
    const BaseCurrencyPicker = (await import('@/components/BaseCurrencyPicker.vue')).default
    const wrapper = mount(BaseCurrencyPicker, {
      props: { show: true },
    })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    vi.doUnmock('@/composables/useBaseCurrency')
  })

  it.fails('A.11.7 modal does not render when baseCurrency is already set', async () => {
    vi.doMock('@/composables/useBaseCurrency', () => ({
      useBaseCurrency: () => ({
        baseCurrency: ref('USD'),
        setBaseCurrency: vi.fn(),
        loading: ref(false),
      }),
    }))
    const BaseCurrencyPicker = (await import('@/components/BaseCurrencyPicker.vue')).default
    const wrapper = mount(BaseCurrencyPicker, {
      props: { show: false },
    })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    vi.doUnmock('@/composables/useBaseCurrency')
  })
})
