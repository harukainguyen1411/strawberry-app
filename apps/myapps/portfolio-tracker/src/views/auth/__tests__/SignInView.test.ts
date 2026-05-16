/**
 * B.1 — V0 SignInView regression tests for Google sign-in flow.
 *
 * Replaces A.17 (email-link). handleSignIn must call signInWithGoogle exactly
 * once and route to '/' on success; on allowlist-denied error the error
 * message must surface and routing must not happen.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const mockSignInWithGoogle = vi.fn()
const mockReplace = vi.fn()

vi.mock('@/firebase/auth', () => ({
  signInWithGoogle: (...args: unknown[]) => mockSignInWithGoogle(...args),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

describe('B.1 — V0 SignInView Google flow', () => {
  beforeEach(() => {
    vi.resetModules()
    mockSignInWithGoogle.mockReset()
    mockReplace.mockReset()
  })

  it('B.1.1 renders a "Continue with Google" button', async () => {
    const SignInView = (await import('@/views/auth/SignInView.vue')).default
    const wrapper = mount(SignInView)
    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
    expect(button.text()).toMatch(/continue with google/i)
  })

  it('B.1.2 click calls signInWithGoogle once', async () => {
    mockSignInWithGoogle.mockResolvedValue({ uid: 'u-123', email: 'duong@allowed.test' })
    const SignInView = (await import('@/views/auth/SignInView.vue')).default
    const wrapper = mount(SignInView)
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1)
  })

  it('B.1.3 on success, router.replace("/") is invoked', async () => {
    mockSignInWithGoogle.mockResolvedValue({ uid: 'u-123', email: 'duong@allowed.test' })
    const SignInView = (await import('@/views/auth/SignInView.vue')).default
    const wrapper = mount(SignInView)
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(mockReplace).toHaveBeenCalledWith('/')
  })

  it('B.1.4 on permission-denied error, error message is shown and router.replace is NOT called', async () => {
    mockSignInWithGoogle.mockRejectedValue(
      Object.assign(new Error('Your email is not authorized to access this app.'), {
        code: 'functions/permission-denied',
      }),
    )
    const SignInView = (await import('@/views/auth/SignInView.vue')).default
    const wrapper = mount(SignInView)
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toMatch(/not authorized/i)
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
