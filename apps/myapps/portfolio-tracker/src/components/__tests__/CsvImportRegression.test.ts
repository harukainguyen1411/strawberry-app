/**
 * Regression tests for Senna CHANGES_REQUESTED review (2026-04-19)
 * Refs V0.11, Rule 13 — regression tests (xfails converted to passing after fix)
 *
 * A.17.R1 — parseResult is non-null after a successful parse (step-2 advancement)
 *   REGRESSION: `parseResult.value = useCsvParser().result.value` constructed a new
 *   composable instance whose result was always null. Fix: destructure `result` from
 *   the single setup-time call and assign `parseResult.value = result.value`.
 *
 * A.17.R2 — DropZone errorId stability
 *   The `errorId` was a computed with `Math.random()` which could produce a different
 *   value across re-renders. Fixed to a module-scoped counter producing stable ids.
 *
 * A.17.R3 — DropZone emits error when multiple files are dropped simultaneously
 *   New behavior: drop of >1 file emits 'error'; before fix, files[0] was silently used.
 *
 * A.17.R4 — CsvPasteArea hard-rejects content > 10 MB
 *   New behavior: hard reject at 10 MB with 'too-large' event; 1 MB warn retained.
 *
 * A.17.R5 — FileReader onerror surfaces via dropError
 *   REGRESSION: missing onerror handler left fileText stale on read failure.
 */

import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref, nextTick } from 'vue'

// ---- Router + Auth stubs (hoisted) -----------------------------------------

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
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

// Controlled mock for useCsvParser: parse() populates result.value so we can
// assert that parseResult in CsvImport gets the same object.
// This must be at module scope (vi.mock is hoisted; closures over inner consts fail).
const FAKE_RESULT = { trades: [{ id: 'T1' }], positions: [], errors: [] } as const

vi.mock('@/composables/useCsvParser', () => ({
  useCsvParser: vi.fn(() => {
    const result = ref<typeof FAKE_RESULT | null>(null)
    const parseError = ref<string | null>(null)
    const loading = ref(false)
    const reset = vi.fn(() => { result.value = null; parseError.value = null })
    const parse = vi.fn(async (_source: string, _text: string) => {
      // Simulate a successful parse: populate result (no parseError)
      result.value = FAKE_RESULT as unknown as typeof FAKE_RESULT
      parseError.value = null
    })
    return { result, parseError, loading, parse, reset }
  }),
}))

// ---- A.17.R1 — parseResult non-null after successful parse -----------------

describe('A.17.R1 — parseResult populated after onParse (regression: double-instance bug)', () => {
  it('A.17.R1 parseResult is non-null and equals result.value after parse() succeeds', async () => {
    const { default: CsvImport } = await import('@/views/CsvImport.vue')
    const wrapper = mount(CsvImport, { attachTo: document.body })
    await nextTick()

    // Select source
    const sourceSelect = wrapper.find('select')
    await sourceSelect.setValue('T212')
    await nextTick()

    // Provide paste text so canParse becomes true
    const textarea = wrapper.find('textarea')
    await textarea.setValue('Date,Symbol\n2026-01-01,AAPL')
    await nextTick()

    // Click "Parse →"
    const parseBtn = wrapper.find('[data-testid="parse-btn"]')
    expect((parseBtn.element as HTMLButtonElement).disabled).toBe(false)
    await parseBtn.trigger('click')
    await flushPromises()
    await nextTick()

    // After fix: result from the shared composable instance propagates to parseResult.
    // Before fix: a second useCsvParser() call returned a fresh null instance.
    expect(wrapper.vm.parseResult).not.toBeNull()
    expect(wrapper.vm.parseResult).toEqual(FAKE_RESULT)
    expect(wrapper.vm.step).toBe('step2')

    wrapper.unmount()
  })
})

// ---- A.17.R2 — errorId stable in DropZone ----------------------------------

describe('A.17.R2 — DropZone errorId is stable (regression: Math.random in computed)', () => {
  it('A.17.R2 errorId is stable across multiple ticks in same instance', async () => {
    const { default: DropZone } = await import('@/components/DropZone.vue')
    const wrapper = mount(DropZone, {
      props: { accept: '.csv', maxSizeMb: 10 },
      attachTo: document.body,
    })
    await nextTick()

    // Trigger error state so the aria-describedby id is rendered
    const file = new File(['x'], 'data.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    ;(wrapper.vm as unknown as { handleFile: (f: File) => void }).handleFile(file)
    await nextTick()

    const idBefore = wrapper.find('[id^="dropzone-error-"]').attributes('id')
    await nextTick()
    const idAfter = wrapper.find('[id^="dropzone-error-"]').attributes('id')

    expect(idBefore).toBeTruthy()
    expect(idBefore).toBe(idAfter)

    wrapper.unmount()
  })
})

// ---- A.17.R3 — Multi-file drop emits error ---------------------------------
//
// jsdom has neither DataTransfer nor DragEvent constructors.
// DropZone exposes `onDrop` for testing so we can call it with a fake event
// object that carries a fake FileList, bypassing the jsdom limitation.

describe('A.17.R3 — DropZone rejects multi-file drop', () => {
  it('A.17.R3 onDrop with >1 file emits error instead of silently using files[0]', async () => {
    const { default: DropZone } = await import('@/components/DropZone.vue')
    const wrapper = mount(DropZone, {
      props: { accept: '.csv', maxSizeMb: 10 },
      attachTo: document.body,
    })
    await nextTick()

    const file1 = new File(['a,b'], 'first.csv', { type: 'text/csv' })
    const file2 = new File(['c,d'], 'second.csv', { type: 'text/csv' })
    const fakeFileList = Object.assign([file1, file2], {
      length: 2,
      item: (i: number) => [file1, file2][i] ?? null,
    })

    // Call the exposed onDrop directly with a fake DragEvent-like object
    ;(wrapper.vm as unknown as { onDrop: (e: { dataTransfer?: { files: typeof fakeFileList } }) => void })
      .onDrop({ dataTransfer: { files: fakeFileList } })
    await nextTick()

    // After fix: error is emitted for multi-file drop
    expect(wrapper.emitted('error')).toBeTruthy()
    const errorMsg = (wrapper.emitted('error') as string[][])[0][0]
    expect(errorMsg).toMatch(/multiple|one file/i)

    wrapper.unmount()
  })
})

// ---- A.17.R4 — CsvPasteArea hard-rejects > 10 MB --------------------------

describe('A.17.R4 — CsvPasteArea hard-rejects content > 10 MB', () => {
  it('A.17.R4 pasting > 10 MB emits too-large and does not propagate modelValue', async () => {
    const { default: CsvPasteArea } = await import('@/components/CsvPasteArea.vue')
    const wrapper = mount(CsvPasteArea, {
      props: { modelValue: '' },
      attachTo: document.body,
    })
    await nextTick()

    // 11 MB of text
    const hugeText = 'A'.repeat(11 * 1024 * 1024)
    const textarea = wrapper.find('textarea')
    const inputEvent = new Event('input', { bubbles: true })
    Object.defineProperty(textarea.element, 'value', { value: hugeText, writable: true })
    textarea.element.dispatchEvent(inputEvent)
    await nextTick()

    // After fix: too-large is emitted; update:modelValue is NOT emitted
    expect(wrapper.emitted('too-large')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')).toBeFalsy()

    wrapper.unmount()
  })
})

// ---- A.17.R5 — FileReader onerror surfaces via dropError -------------------

describe('A.17.R5 — FileReader onerror surfaces in CsvImport', () => {
  it('A.17.R5 FileReader read failure populates dropError and keeps fileText null', async () => {
    // Stub FileReader to fire onerror synchronously
    const OriginalFileReader = globalThis.FileReader
    class FakeFileReader {
      onerror: ((e: ProgressEvent) => void) | null = null
      onload: ((e: ProgressEvent) => void) | null = null
      readAsText(_blob: Blob) {
        if (this.onerror) {
          this.onerror(new ProgressEvent('error'))
        }
      }
    }
    globalThis.FileReader = FakeFileReader as unknown as typeof FileReader

    const { default: CsvImport } = await import('@/views/CsvImport.vue')
    const wrapper = mount(CsvImport, { attachTo: document.body })
    await nextTick()

    const file = new File(['content'], 'data.csv', { type: 'text/csv' })
    ;(wrapper.vm as unknown as { onFileDropped: (f: File) => void }).onFileDropped(file)
    await nextTick()

    // After fix: dropError is populated; fileText remains null
    const vm = wrapper.vm as unknown as { fileText: string | null; dropError: string | null }
    expect(vm.fileText).toBeNull()
    expect(vm.dropError).toBeTruthy()

    globalThis.FileReader = OriginalFileReader
    wrapper.unmount()
  })
})
