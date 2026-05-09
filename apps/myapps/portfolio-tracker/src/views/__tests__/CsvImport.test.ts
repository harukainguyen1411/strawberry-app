/**
 * V0.1.2 — CsvImport post-success UX: toast + auto-nav to /
 *
 * Refs V0.1.2
 *
 * V012.1 — Successful import → toast shows "Imported N trades · M positions" + router.push('/') called
 * V012.2 — Failed parse → toast shows parse error message + router.push NOT called
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref, nextTick } from 'vue'

// ---- Hoisted mocks -----------------------------------------------------------

const mockPush = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ path: '/import', meta: {} }),
  RouterView: defineComponent({ render: () => h('div') }),
  RouterLink: defineComponent({ props: ['to'], render() { return h('a', {}, this.$slots.default?.()) } }),
  createRouter: vi.fn(),
  createWebHistory: vi.fn(),
}))

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    email: { value: 'duong@test.com' },
    uid: { value: 'user123' },
    isAuthenticated: { value: true },
  }),
}))

// Controlled mock for useCsvParser — two modes: success and parse-error
let mockParseMode: 'success' | 'error' = 'success'

vi.mock('@/composables/useCsvParser', () => ({
  useCsvParser: vi.fn(() => {
    const FAKE_RESULT = { trades: [{ id: 'T1' }, { id: 'T2' }], positions: [{ ticker: 'AAPL' }], errors: [] }
    const result = ref<typeof FAKE_RESULT | null>(null)
    const parseError = ref<string | null>(null)
    const loading = ref(false)
    const reset = vi.fn(() => { result.value = null; parseError.value = null })
    const parse = vi.fn(async (_source: string, _text: string) => {
      if (mockParseMode === 'success') {
        result.value = FAKE_RESULT as unknown as typeof FAKE_RESULT
        parseError.value = null
      } else {
        result.value = null
        parseError.value = 'Unrecognised column headers. Export from your broker again.'
      }
    })
    return { result, parseError, loading, parse, reset }
  }),
}))

// Controlled mock for useImportCsv — resolves with 2 trades + 1 position
vi.mock('@/composables/useImportCsv', () => ({
  useImportCsv: vi.fn(() => ({
    importCsv: vi.fn().mockResolvedValue({
      tradesAdded: 2,
      tradesSkipped: 0,
      positionsWritten: 1,
      errors: [],
    }),
    loading: ref(false),
    error: ref(null),
  })),
}))

// ---- Helpers -----------------------------------------------------------------

async function mountImportAtStep2() {
  mockParseMode = 'success'
  const { default: CsvImport } = await import('@/views/CsvImport.vue')
  const wrapper = mount(CsvImport, { attachTo: document.body })
  await nextTick()

  // Select source
  await wrapper.find('select').setValue('T212')
  await nextTick()

  // Provide paste text so canParse is true
  await wrapper.find('textarea').setValue('Date,Symbol\n2026-01-01,AAPL')
  await nextTick()

  // Click "Parse →"
  await wrapper.find('[data-testid="parse-btn"]').trigger('click')
  await flushPromises()
  await nextTick()

  // Should now be on step2
  expect(wrapper.vm.step).toBe('step2')
  return wrapper
}

// ---- Tests -------------------------------------------------------------------

describe('V0.1.2 — CsvImport post-success UX', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockParseMode = 'success'
    vi.resetModules()
  })

  it('V012.1 successful commit → toast shows "Imported N trades · M positions" and router.push("/") is called', async () => {
    const wrapper = await mountImportAtStep2()

    // Click "Commit import →"
    await wrapper.find('[data-testid="commit-btn"]').trigger('click')
    await flushPromises()
    await nextTick()

    // Toast must be visible with the correct message format
    const toast = wrapper.find('[data-testid="toast"]')
    expect(toast.exists()).toBe(true)
    expect(toast.text()).toMatch(/Imported 2 trades · 1 position/i)

    // Router must have navigated to /
    expect(mockPush).toHaveBeenCalledWith('/')

    wrapper.unmount()
  })

  it('V012.2 failed parse → toast shows parse error message + router.push NOT called', async () => {
    mockParseMode = 'error'
    const { default: CsvImport } = await import('@/views/CsvImport.vue')
    const wrapper = mount(CsvImport, { attachTo: document.body })
    await nextTick()

    // Select source + paste text
    await wrapper.find('select').setValue('T212')
    await nextTick()
    await wrapper.find('textarea').setValue('bad,csv,data\n1,2,3')
    await nextTick()

    // Click "Parse →" — parse will fail
    await wrapper.find('[data-testid="parse-btn"]').trigger('click')
    await flushPromises()
    await nextTick()

    // Should stay on step1 (not advance to step2)
    expect(wrapper.vm.step).toBe('step1')

    // Toast must be visible with the parse error message
    const toast = wrapper.find('[data-testid="toast"]')
    expect(toast.exists()).toBe(true)
    expect(toast.text()).toMatch(/Unrecognised column headers/i)

    // Router must NOT have been called
    expect(mockPush).not.toHaveBeenCalled()

    wrapper.unmount()
  })
})
