/**
 * A.17 — SignInView regression tests (Refs V0.10 Senna review)
 *
 * Regression: handleSubmit must never fake success (set sent=true) without
 * calling the real auth API. When VITE_USE_AUTH_EMULATOR is not true the
 * view must show an error, not the "check your inbox" banner.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

// Mock firebase/auth sendSignInLinkToEmail
const mockSendSignInLinkToEmail = vi.fn()
vi.mock('firebase/auth', () => ({
  sendSignInLinkToEmail: (...args: unknown[]) => mockSendSignInLinkToEmail(...args),
}))

// Mock firebase config
vi.mock('@/firebase/config', () => ({
  auth: {},
  db: {},
}))

describe('A.17 — SignInView regression: no fake success', () => {
  beforeEach(() => {
    mockSendSignInLinkToEmail.mockReset()
    vi.unstubAllEnvs()
  })

  it('A.17.1 does NOT set sent=true when VITE_USE_AUTH_EMULATOR is not set', async () => {
    vi.stubEnv('VITE_USE_AUTH_EMULATOR', '')
    const SignInView = (await import('@/views/SignInView.vue')).default
    const wrapper = mount(SignInView)
    await wrapper.find('input[type="email"]').setValue('user@test.com')
    await wrapper.find('form').trigger('submit')
    await nextTick()
    // "Check your inbox" banner must not appear
    expect(wrapper.find('.text-positive, [style*="--positive"]').exists() && wrapper.text().includes('Check your inbox')).toBe(false)
    expect(mockSendSignInLinkToEmail).not.toHaveBeenCalled()
    // Error message shown instead
    expect(wrapper.text()).toMatch(/not yet available|V0\.2/i)
  })

  it('A.17.2 calls sendSignInLinkToEmail when VITE_USE_AUTH_EMULATOR=true', async () => {
    vi.stubEnv('VITE_USE_AUTH_EMULATOR', 'true')
    mockSendSignInLinkToEmail.mockResolvedValue(undefined)
    const SignInView = (await import('@/views/SignInView.vue')).default
    const wrapper = mount(SignInView)
    await wrapper.find('input[type="email"]').setValue('user@test.com')
    await wrapper.find('form').trigger('submit')
    await nextTick()
    await nextTick()
    expect(mockSendSignInLinkToEmail).toHaveBeenCalledWith(
      expect.anything(),
      'user@test.com',
      expect.objectContaining({ handleCodeInApp: true })
    )
  })
})
