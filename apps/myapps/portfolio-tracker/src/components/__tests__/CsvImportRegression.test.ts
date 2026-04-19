/**
 * Regression tests for Senna CHANGES_REQUESTED review (2026-04-19)
 * Refs V0.11, Rule 13 — xfail tests committed before fix
 *
 * A.17.R1 — parseResult is non-null after a successful parse (step-2 advancement)
 *   REGRESSION: `parseResult.value = useCsvParser().result.value` constructed a new
 *   composable instance whose result was always null. Fix: destructure `result` from
 *   the single setup-time call and assign `parseResult.value = result.value`.
 *
 * A.17.R2 — DropZone errorId stability (design issue — tests current behavior)
 *   The `errorId` was a computed with `Math.random()` which could produce a different
 *   value across re-renders. In practice the computed caches per reactive-dependency
 *   change, but the design is fragile (no reactive dep = evaluated at random on first
 *   read only). Tests that errorId is stable within a component lifecycle.
 *   NOTE: not using it.fails because the bug doesn't manifest as a test assertion
 *   failure in jsdom — it is a code-quality issue addressed as part of the fix.
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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'

// ---- Router + Auth stubs shared by all tests (top-level hoisting) ----------

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

// ---- Minimal T212 fixture ---------------------------------------------------

const T212_CSV = `Action,Time,ISIN,Ticker,Name,No. of shares,Price / share,Currency (Price / share),Exchange rate,Result,Total,Currency (Total),Withholding tax,Currency (Withholding tax),Charge amount (GBP),Notes
Market buy,2026-01-02 10:00:00,US0378331005,AAPL,Apple Inc,1,150.00,USD,1.0,0,150.00,USD,0,USD,0,
`

// ---- A.17.R1 — parseResult non-null after successful parse -----------------

describe('A.17.R1 — parseResult populated after onParse (regression: double-instance bug)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it.fails('xfail: parseResult is non-null when step advances to step2', async () => {
    // Use real useCsvParser (unmocked) with a real T212 fixture.
    // This will fail before the fix because the second useCsvParser() call
    // constructs a new instance whose result is always null.
    const CsvImport = (await import('@/views/CsvImport.vue')).default
    const wrapper = mount(CsvImport, { attachTo: document.body })
    await nextTick()

    const sourceSelect = wrapper.find('select')
    await sourceSelect.setValue('T212')
    await nextTick()

    const textarea = wrapper.find('textarea')
    await textarea.setValue(T212_CSV)
    await nextTick()

    const parseBtn = wrapper.find('[data-testid="parse-btn"]')
    await parseBtn.trigger('click')
    await flushPromises()
    await nextTick()

    // REGRESSION: before fix parseResult is null; after fix it should be non-null
    expect(wrapper.vm.parseResult).not.toBeNull()
    expect(wrapper.vm.step).toBe('step2')

    wrapper.unmount()
  })
})

// ---- A.17.R2 — errorId stable in DropZone ----------------------------------

describe('A.17.R2 — DropZone errorId does not change across re-renders', () => {
  // Note: Math.random() in a computed() with no reactive deps is evaluated once
  // and cached — stable within a single component lifecycle in Vue. The code smell
  // is that the id could differ between component instances or across tick boundaries
  // if reactive deps ever change. The fix replaces this with a module-scoped counter
  // producing a deterministic id. This test verifies stability within one lifecycle.
  it('A.17.R2 errorId is stable across multiple ticks in same instance', async () => {
    const { default: DropZone } = await import('@/components/DropZone.vue')
    const wrapper = mount(DropZone, {
      props: { accept: '.csv', maxSizeMb: 10 },
      attachTo: document.body,
    })
    await nextTick()

    // Trigger error state so the aria-describedby id is rendered in DOM
    const file = new File(['x'], 'data.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    ;(wrapper.vm as { handleFile: (f: File) => void }).handleFile(file)
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

describe('A.17.R3 — DropZone rejects multi-file drop', () => {
  it.fails('xfail: dropping >1 file emits an error instead of silently using files[0]', async () => {
    const { default: DropZone } = await import('@/components/DropZone.vue')
    const wrapper = mount(DropZone, {
      props: { accept: '.csv', maxSizeMb: 10 },
      attachTo: document.body,
    })
    await nextTick()

    const file1 = new File(['a,b'], 'first.csv', { type: 'text/csv' })
    const file2 = new File(['c,d'], 'second.csv', { type: 'text/csv' })
    const dt = new DataTransfer()
    dt.items.add(file1)
    dt.items.add(file2)

    const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(dropEvent, 'dataTransfer', { value: dt })
    wrapper.element.dispatchEvent(dropEvent)
    await nextTick()

    // REGRESSION: before fix no error is emitted, files[0] is silently used
    expect(wrapper.emitted('error')).toBeTruthy()
    const errorMsg = (wrapper.emitted('error') as string[][])[0][0]
    expect(errorMsg).toMatch(/multiple|one file/i)

    wrapper.unmount()
  })
})

// ---- A.17.R4 — CsvPasteArea hard-rejects > 10 MB --------------------------

describe('A.17.R4 — CsvPasteArea hard-rejects content > 10 MB', () => {
  it.fails('xfail: pasting > 10 MB emits too-large and update:modelValue is blocked', async () => {
    const { default: CsvPasteArea } = await import('@/components/CsvPasteArea.vue')
    const wrapper = mount(CsvPasteArea, {
      props: { modelValue: '' },
      attachTo: document.body,
    })
    await nextTick()

    // Build 11 MB of text and dispatch input event
    const hugeText = 'A'.repeat(11 * 1024 * 1024)
    const textarea = wrapper.find('textarea')
    const inputEvent = new Event('input', { bubbles: true })
    Object.defineProperty(textarea.element, 'value', { value: hugeText, writable: true })
    textarea.element.dispatchEvent(inputEvent)
    await nextTick()

    // REGRESSION: before fix only soft warn is shown; no 'too-large' event emitted
    expect(wrapper.emitted('too-large')).toBeTruthy()

    wrapper.unmount()
  })
})

// ---- A.17.R5 — FileReader onerror surfaces via dropError -------------------

describe('A.17.R5 — FileReader onerror surfaces in CsvImport', () => {
  it.fails('xfail: FileReader read failure populates dropError and clears fileText', async () => {
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

    vi.resetModules()

    const CsvImport = (await import('@/views/CsvImport.vue')).default
    const wrapper = mount(CsvImport, { attachTo: document.body })
    await nextTick()

    const file = new File(['content'], 'data.csv', { type: 'text/csv' })
    // Call the internal handler that triggers FileReader
    ;(wrapper.vm as { onFileDropped: (f: File) => void }).onFileDropped(file)
    await nextTick()

    // REGRESSION: before fix onerror is absent; fileText may stay null but no error surface
    // After fix: dropError should be set and fileText should remain null
    const vm = wrapper.vm as { fileText: string | null; dropError: string | null }
    expect(vm.fileText).toBeNull()
    expect(vm.dropError).toBeTruthy()

    globalThis.FileReader = OriginalFileReader
    wrapper.unmount()
  })
})
