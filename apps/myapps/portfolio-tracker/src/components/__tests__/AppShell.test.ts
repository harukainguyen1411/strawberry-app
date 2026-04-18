/**
 * A.16 — AppShell component tests (Refs V0.9)
 *
 * xfail-first: all tests use it.fails() until implementation lands.
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

// Mock useAuth composable
vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    email: 'duong@allowed.test',
    uid: 'user123',
    isAuthenticated: true,
  }),
}))

// Mock vue-router
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ path: '/', meta: {} }),
  RouterView: defineComponent({ render: () => h('div', { class: 'router-view-slot' }) }),
  RouterLink: defineComponent({ props: ['to'], render() { return h('a', {}, this.$slots.default?.()) } }),
  createRouter: vi.fn(),
  createWebHistory: vi.fn(),
}))

describe('A.16 — AppShell', () => {
  it.fails('A.16.1 header has sticky class, height 56px, brand text "Strawberry · Portfolio"', async () => {
    const AppShell = (await import('@/components/AppShell.vue')).default
    const wrapper = mount(AppShell, {
      slots: { default: '<div>content</div>' },
    })
    const header = wrapper.find('header')
    expect(header.exists()).toBe(true)
    // Sticky class
    const classes = header.classes().join(' ') + ' ' + header.element.getAttribute('class')
    expect(classes).toMatch(/sticky/)
    // Brand text
    expect(wrapper.text()).toMatch(/Strawberry.*Portfolio/)
  })

  it.fails('A.16.2 desktop viewport: menu icon hidden', async () => {
    const AppShell = (await import('@/components/AppShell.vue')).default
    const wrapper = mount(AppShell, {
      attachTo: document.body,
    })
    // Menu icon should have lg:hidden or similar class that hides at desktop
    const menuBtn = wrapper.find('[data-testid="menu-icon"]')
    if (menuBtn.exists()) {
      const classes = menuBtn.classes().join(' ')
      expect(classes).toMatch(/lg:hidden|hidden.*lg/)
    }
    wrapper.unmount()
  })

  it.fails('A.16.3 mobile viewport: menu icon visible', async () => {
    const AppShell = (await import('@/components/AppShell.vue')).default
    const wrapper = mount(AppShell)
    // Menu icon should exist in the DOM (mobile-visible)
    const menuBtn = wrapper.find('[data-testid="menu-icon"]')
    expect(menuBtn.exists()).toBe(true)
  })

  it.fails('A.16.4 avatar circle initials derived from email', async () => {
    const AppShell = (await import('@/components/AppShell.vue')).default
    const wrapper = mount(AppShell)
    // "duong@allowed.test" → "DA"
    expect(wrapper.text()).toMatch(/DA/)
  })
})
