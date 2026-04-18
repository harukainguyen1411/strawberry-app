import { cleanup } from '@testing-library/vue'
import { vi, afterEach } from 'vitest'

// Provide a working localStorage for jsdom (Vitest's env can expose a non-standard one)
const storage: Record<string, string> = {}
const mockLocalStorage = {
  getItem: (k: string) => storage[k] ?? null,
  setItem: (k: string, v: string) => { storage[k] = String(v) },
  removeItem: (k: string) => { delete storage[k] },
  clear: () => { Object.keys(storage).forEach((k) => delete storage[k]) },
  get length() { return Object.keys(storage).length },
  key: () => null
}
Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true })
mockLocalStorage.setItem('preferredLanguage', 'en')

// Mock Firebase config so modules importing it don't throw in CI (no .env)
vi.mock('@/firebase/config', () => ({
  __esModule: true,
  default: {},
  db: {},
  auth: {},
  analytics: null,
  remoteConfig: {}
}))

vi.mock('@/composables/useFeatureFlag', () => ({
  useFeatureFlag: () => ({ value: false }),
  fetchFeatureFlags: vi.fn().mockResolvedValue(undefined)
}))

// Mock Firebase auth so stores and components don't call real Firebase
vi.mock('@/firebase/auth', () => ({
  onAuthChange: (cb: (u: unknown) => void) => {
    cb(null)
  },
  signInWithGoogle: vi.fn(),
  logout: vi.fn()
}))

afterEach(() => {
  cleanup()
})
