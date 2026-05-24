import { describe, it, expect, vi, beforeEach } from 'vitest'

// The global setup.ts mocks @/firebase/config to avoid real Firebase init in all other tests.
// This test exercises the real module, so we lift that mock here.
vi.unmock('@/firebase/config')

// Remote config requires a full Firebase app (appId etc). Stub it out so test env
// with minimal config (only apiKey + projectId) doesn't throw.
vi.mock('firebase/remote-config', async (orig) => ({
  ...(await orig() as object),
  getRemoteConfig: vi.fn(() => ({
    settings: { minimumFetchIntervalMillis: 3_600_000 },
    defaultConfig: {}
  })),
}))

// Analytics is browser-only; stub isSupported to avoid side effects in jsdom.
vi.mock('firebase/analytics', async (orig) => ({
  ...(await orig() as object),
  isSupported: vi.fn().mockResolvedValue(false),
  getAnalytics: vi.fn(),
}))

describe('firebase/config — functions + emulator wiring', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('exports a functions instance', async () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-key')
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project')
    vi.stubEnv('VITE_USE_FIREBASE_EMULATOR', 'false')
    const mod = await import('@/firebase/config')
    expect(mod.functions).toBeDefined()
    expect(typeof mod.functions).toBe('object')
  })

  it('connects all four emulators when VITE_USE_FIREBASE_EMULATOR=true', async () => {
    const connectAuth = vi.fn()
    const connectFirestore = vi.fn()
    const connectStorage = vi.fn()
    const connectFunctions = vi.fn()
    vi.doMock('firebase/auth', async (orig) => ({
      ...(await orig() as object),
      connectAuthEmulator: connectAuth,
    }))
    vi.doMock('firebase/firestore', async (orig) => ({
      ...(await orig() as object),
      connectFirestoreEmulator: connectFirestore,
    }))
    vi.doMock('firebase/storage', async (orig) => ({
      ...(await orig() as object),
      connectStorageEmulator: connectStorage,
    }))
    vi.doMock('firebase/functions', async (orig) => ({
      ...(await orig() as object),
      connectFunctionsEmulator: connectFunctions,
    }))
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-key')
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project')
    vi.stubEnv('VITE_USE_FIREBASE_EMULATOR', 'true')

    await import('@/firebase/config')

    expect(connectAuth).toHaveBeenCalledWith(expect.anything(), 'http://localhost:9099', { disableWarnings: true })
    expect(connectFirestore).toHaveBeenCalledWith(expect.anything(), 'localhost', 8080)
    expect(connectStorage).toHaveBeenCalledWith(expect.anything(), 'localhost', 9199)
    expect(connectFunctions).toHaveBeenCalledWith(expect.anything(), 'localhost', 5001)
  })

  it('does not connect emulators when VITE_USE_FIREBASE_EMULATOR is unset', async () => {
    const connectAuth = vi.fn()
    vi.doMock('firebase/auth', async (orig) => ({
      ...(await orig() as object),
      connectAuthEmulator: connectAuth,
    }))
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-key')
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project')
    vi.stubEnv('VITE_USE_FIREBASE_EMULATOR', '')

    await import('@/firebase/config')

    expect(connectAuth).not.toHaveBeenCalled()
  })
})
