/**
 * Regression test — duplicate sign-in route (Refs V0.2)
 *
 * Ensures router has no duplicate route names or paths so Vue Router 4
 * never silently drops a registration.
 */

import { describe, it, expect, vi } from 'vitest'

// Mock firebase-dependent modules before importing the router
vi.mock('@/firebase/config', () => ({ firebaseConfig: {} }))
vi.mock('@/firebase/auth', () => ({ auth: {} }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ loading: false, isAuthenticated: false }),
}))
vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: { value: false } }),
}))

describe('router — no duplicate routes', () => {
  it('each route name is unique', async () => {
    const { routes } = await import('../index')
    const names = routes.flatMap((r) => (r.name ? [String(r.name)] : []))
    const unique = new Set(names)
    expect(names.length).toBe(unique.size)
  })

  it('each top-level route path is unique', async () => {
    const { routes } = await import('../index')
    const paths = routes.map((r) => r.path)
    const unique = new Set(paths)
    expect(paths.length).toBe(unique.size)
  })

  it('/sign-in route appears exactly once', async () => {
    const { routes } = await import('../index')
    expect(routes.filter((r) => r.path === '/sign-in').length).toBe(1)
  })

  it('/sign-in-callback route is present', async () => {
    const { routes } = await import('../index')
    expect(routes.find((r) => r.path === '/sign-in-callback')).toBeDefined()
  })
})
