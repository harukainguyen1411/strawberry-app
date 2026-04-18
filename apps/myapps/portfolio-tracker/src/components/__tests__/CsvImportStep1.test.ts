/**
 * A.17 — CsvImport Step 1 tests (Refs V0.11)
 *
 * Tests:
 * - "Parse →" disabled when both file and paste are empty.
 * - Drop event with non-CSV file emits error.
 * - Source change clears parse state.
 * - CsvPasteArea emits update:modelValue on input.
 *
 * Implementation: it.fails() → it() — components are implemented.
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { nextTick } from 'vue'

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

// Mock the CSV parsers to avoid importing Node.js functions modules in jsdom
vi.mock('@/composables/useCsvParser', () => ({
  useCsvParser: vi.fn(() => ({
    parse: vi.fn(),
    result: { value: null },
    parseError: { value: null },
    loading: { value: false },
    reset: vi.fn(),
  })),
}))

describe('A.17 — CsvImport Step 1', () => {
  it('A.17.1 "Parse →" button is disabled when both file and paste are empty', async () => {
    const CsvImport = (await import('@/views/CsvImport.vue')).default
    const wrapper = mount(CsvImport, {
      attachTo: document.body,
    })
    await nextTick()

    const parseBtn = wrapper.find('[data-testid="parse-btn"]')
    expect(parseBtn.exists()).toBe(true)
    expect((parseBtn.element as HTMLButtonElement).disabled).toBe(true)

    wrapper.unmount()
  })

  it('A.17.2 DropZone emits "error" when a non-CSV file is dropped', async () => {
    const DropZone = (await import('@/components/DropZone.vue')).default
    const wrapper = mount(DropZone, {
      props: { accept: '.csv', maxSizeMb: 10 },
      attachTo: document.body,
    })

    // Create a fake non-CSV file (xlsx)
    const file = new File(['content'], 'data.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    // DragEvent.dataTransfer is read-only in jsdom; call the exposed method directly
    // (same code path as the drop handler)
    ;(wrapper.vm as { handleFile: (f: File) => void }).handleFile(file)
    await nextTick()

    expect(wrapper.emitted('error')).toBeTruthy()
    wrapper.unmount()
  })

  it('A.17.3 Changing the source select emits update:modelValue', async () => {
    const SourceSelect = (await import('@/components/SourceSelect.vue')).default
    const wrapper = mount(SourceSelect, {
      props: { modelValue: 'T212' },
    })

    const select = wrapper.find('select')
    expect(select.exists()).toBe(true)
    await select.setValue('IB')
    await nextTick()

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['IB'])

    wrapper.unmount()
  })

  it('A.17.4 CsvPasteArea emits update:modelValue when text is typed', async () => {
    const CsvPasteArea = (await import('@/components/CsvPasteArea.vue')).default
    const wrapper = mount(CsvPasteArea, {
      props: { modelValue: '' },
    })

    const textarea = wrapper.find('textarea')
    expect(textarea.exists()).toBe(true)
    await textarea.setValue('Date,Symbol,Action\n2026-01-01,AAPL,BUY')
    await nextTick()

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    wrapper.unmount()
  })
})
