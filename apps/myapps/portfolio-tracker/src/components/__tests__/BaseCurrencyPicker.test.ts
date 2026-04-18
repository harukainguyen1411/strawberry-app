/**
 * A.11 — BaseCurrencyPicker component tests (Refs V0.10)
 *
 * Implementation: it.fails() flipped to it() — component is implemented.
 *
 * Note: The component uses <Teleport to="body"> so modal content renders
 * in document.body, not inside the wrapper element. Tests query the DOM
 * directly for teleported elements.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref, computed, nextTick } from 'vue'

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
  let wrapper: VueWrapper<unknown>

  afterEach(() => {
    wrapper?.unmount()
    // Clean up any teleported nodes
    document.body.innerHTML = ''
  })

  it('A.11.1 Continue button is disabled on mount (no radio selected)', async () => {
    const BaseCurrencyPicker = (await import('@/components/BaseCurrencyPicker.vue')).default
    wrapper = mount(BaseCurrencyPicker, {
      props: { show: true },
      attachTo: document.body,
    })
    await nextTick()
    const btn = document.body.querySelector('button[data-testid="continue-btn"]') as HTMLButtonElement | null
    expect(btn).not.toBeNull()
    expect(btn!.disabled).toBe(true)
  })

  it('A.11.2 clicking USD radio enables Continue', async () => {
    const BaseCurrencyPicker = (await import('@/components/BaseCurrencyPicker.vue')).default
    wrapper = mount(BaseCurrencyPicker, {
      props: { show: true },
      attachTo: document.body,
    })
    await nextTick()
    const usdInput = document.body.querySelector('input[value="USD"]') as HTMLInputElement | null
    expect(usdInput).not.toBeNull()
    usdInput!.click()
    await nextTick()
    const btn = document.body.querySelector('button[data-testid="continue-btn"]') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })

  it('A.11.3 Escape key does not close the modal (show is prop-controlled)', async () => {
    const BaseCurrencyPicker = (await import('@/components/BaseCurrencyPicker.vue')).default
    wrapper = mount(BaseCurrencyPicker, {
      props: { show: true },
      attachTo: document.body,
    })
    await nextTick()
    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    // Dispatch Escape — modal should NOT disappear (show is controlled by parent prop)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    // Still present since show=true prop hasn't changed
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('A.11.4 clicking backdrop does not close modal', async () => {
    const BaseCurrencyPicker = (await import('@/components/BaseCurrencyPicker.vue')).default
    wrapper = mount(BaseCurrencyPicker, {
      props: { show: true },
      attachTo: document.body,
    })
    await nextTick()
    const backdrop = document.body.querySelector('[data-testid="modal-backdrop"]') as HTMLElement | null
    if (backdrop) {
      backdrop.click()
    }
    await nextTick()
    // Modal still present — no close emit
    expect(wrapper.emitted('close')).toBeFalsy()
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('A.11.5 clicking Continue with USD selected emits confirm with "USD"', async () => {
    const BaseCurrencyPicker = (await import('@/components/BaseCurrencyPicker.vue')).default
    wrapper = mount(BaseCurrencyPicker, {
      props: { show: true },
      attachTo: document.body,
    })
    await nextTick()
    const usdInput = document.body.querySelector('input[value="USD"]') as HTMLInputElement
    usdInput.click()
    await nextTick()
    const btn = document.body.querySelector('button[data-testid="continue-btn"]') as HTMLButtonElement
    btn.click()
    await nextTick()
    expect(wrapper.emitted('confirm')).toBeTruthy()
    expect(wrapper.emitted('confirm')?.[0]).toEqual(['USD'])
  })

  it('A.11.6 guard: modal renders when show=true', async () => {
    const BaseCurrencyPicker = (await import('@/components/BaseCurrencyPicker.vue')).default
    wrapper = mount(BaseCurrencyPicker, {
      props: { show: true },
      attachTo: document.body,
    })
    await nextTick()
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('A.11.7 modal does not render when show=false', async () => {
    const BaseCurrencyPicker = (await import('@/components/BaseCurrencyPicker.vue')).default
    wrapper = mount(BaseCurrencyPicker, {
      props: { show: false },
      attachTo: document.body,
    })
    await nextTick()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })
})
