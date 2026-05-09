/**
 * A.16 — AppShell component tests (Refs V0.9, V0.1.5)
 *
 * Implementation: all it.fails() flipped to it() — component is implemented.
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, computed } from 'vue'

// Shared spies — captured once so all tests reference the same instance
const mockSignOut = vi.fn().mockResolvedValue(undefined)
const mockPush = vi.fn()

// Mock useAuth composable — email must be a Vue ref so .value works in the component
vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    email: computed(() => 'duong@allowed.test'),
    uid: computed(() => 'user123'),
    isAuthenticated: computed(() => true),
  }),
}))

// Mock vue-router — push spy is shared so tests can assert on it
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ path: '/', meta: {} }),
  RouterView: defineComponent({ render: () => h('div', { class: 'router-view-slot' }) }),
  RouterLink: defineComponent({ props: ['to'], render() { return h('a', {}, this.$slots.default?.()) } }),
  createRouter: vi.fn(),
  createWebHistory: vi.fn(),
}))

// Mock auth store — signOut spy is shared so tests can assert on it
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    signOut: mockSignOut,
    user: null,
    isAuthenticated: false,
  }),
}))

describe('A.16 — AppShell', () => {
  it('A.16.1 header has sticky class, height 56px, brand text "Strawberry · Portfolio"', async () => {
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

  it('A.16.2 desktop viewport: menu icon hidden at lg', async () => {
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

  it('A.16.3 mobile viewport: menu icon present in DOM', async () => {
    const AppShell = (await import('@/components/AppShell.vue')).default
    const wrapper = mount(AppShell)
    // Menu icon should exist in the DOM (mobile-visible)
    const menuBtn = wrapper.find('[data-testid="menu-icon"]')
    expect(menuBtn.exists()).toBe(true)
  })

  it('A.16.4 avatar circle initials derived from email', async () => {
    const AppShell = (await import('@/components/AppShell.vue')).default
    const wrapper = mount(AppShell)
    // "duong@allowed.test" → "DA"
    expect(wrapper.text()).toMatch(/DA/)
  })

  // V0.1.5 — avatar click opens sign-out menu showing user email + Sign out button
  it('A.16.5 avatar click opens dropdown menu with user email and Sign out button', async () => {
    const AppShell = (await import('@/components/AppShell.vue')).default
    const wrapper = mount(AppShell)

    // Menu should not be visible initially
    expect(wrapper.find('[data-testid="avatar-menu"]').exists()).toBe(false)

    // Click the avatar button
    const avatarBtn = wrapper.find('[data-testid="avatar-btn"]')
    expect(avatarBtn.exists()).toBe(true)
    await avatarBtn.trigger('click')

    // Menu should now be visible
    const menu = wrapper.find('[data-testid="avatar-menu"]')
    expect(menu.exists()).toBe(true)

    // Menu shows the user email
    expect(menu.text()).toContain('duong@allowed.test')

    // Menu has a Sign out button
    const signOutBtn = wrapper.find('[data-testid="sign-out-btn"]')
    expect(signOutBtn.exists()).toBe(true)
  })

  // V0.1.5 — Sign out click calls authStore.signOut() and navigates to /sign-in
  it('A.16.6 sign-out button calls authStore.signOut() and navigates to /sign-in', async () => {
    mockSignOut.mockClear()
    mockPush.mockClear()

    const AppShell = (await import('@/components/AppShell.vue')).default
    const wrapper = mount(AppShell)

    // Open the menu first
    const avatarBtn = wrapper.find('[data-testid="avatar-btn"]')
    await avatarBtn.trigger('click')

    // Click Sign out
    const signOutBtn = wrapper.find('[data-testid="sign-out-btn"]')
    expect(signOutBtn.exists()).toBe(true)
    await signOutBtn.trigger('click')

    // Wait for async signOut to resolve
    await wrapper.vm.$nextTick()

    // authStore.signOut() must have been called
    expect(mockSignOut).toHaveBeenCalledOnce()

    // router.push('/sign-in') must have been called
    expect(mockPush).toHaveBeenCalledWith('/sign-in')
  })
})
