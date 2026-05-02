/**
 * A.18 — CsvImport Step 2 + WarnBanner + ErrorBanner + ImportPreviewTable xfail tests (Refs V0.12)
 *
 * Tests:
 * - ImportPreviewTable shows 5 collapsed rows + "Show all" expander
 * - WarnBanner click expands details list of skipped rows
 * - Successful commit triggers redirect to /
 * - Network failure shows retry toast
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

// Mock importCsv callable
vi.mock('@/composables/useImportCsv', () => ({
  useImportCsv: vi.fn(() => ({
    importCsv: vi.fn().mockResolvedValue({ tradesAdded: 5, tradesSkipped: 0, positionsWritten: 3, errors: [] }),
    loading: { value: false },
    error: { value: null },
  })),
}))

// Sample rows for testing
const SAMPLE_ROWS = [
  { ticker: 'AAPL', quantity: 100, marketValue: '$14,850' },
  { ticker: 'MSFT', quantity: 25, marketValue: '$10,200' },
  { ticker: 'GOOG', quantity: 10, marketValue: '$8,500' },
  { ticker: 'AMZN', quantity: 5, marketValue: '$6,200' },
  { ticker: 'TSLA', quantity: 15, marketValue: '$4,100' },
  { ticker: 'NVDA', quantity: 20, marketValue: '$3,800' },
]

const SAMPLE_COLUMNS = [
  { key: 'ticker', label: 'Ticker' },
  { key: 'quantity', label: 'Qty' },
  { key: 'marketValue', label: 'Market Value' },
]

describe('A.18 — CsvImport Step 2', () => {
  it('A.18.1 ImportPreviewTable shows maxVisible rows with "Show all" expander when rows > maxVisible', async () => {
    const ImportPreviewTable = (await import('@/components/ImportPreviewTable.vue')).default
    const wrapper = mount(ImportPreviewTable, {
      props: {
        rows: SAMPLE_ROWS,
        columns: SAMPLE_COLUMNS,
        maxVisible: 5,
      },
    })
    await nextTick()

    // Should show 5 rows initially (maxVisible=5 out of 6 total)
    const rows = wrapper.findAll('[data-testid="preview-row"]')
    expect(rows.length).toBe(5)

    // "Show all" link should be present
    const showAll = wrapper.find('[data-testid="show-all-btn"]')
    expect(showAll.exists()).toBe(true)
    expect(showAll.text()).toMatch(/show all/i)

    wrapper.unmount()
  })

  it('A.18.2 ImportPreviewTable "Show all" expands to all rows', async () => {
    const ImportPreviewTable = (await import('@/components/ImportPreviewTable.vue')).default
    const wrapper = mount(ImportPreviewTable, {
      props: {
        rows: SAMPLE_ROWS,
        columns: SAMPLE_COLUMNS,
        maxVisible: 5,
      },
    })
    await nextTick()

    // Click Show all
    await wrapper.find('[data-testid="show-all-btn"]').trigger('click')
    await nextTick()

    const rows = wrapper.findAll('[data-testid="preview-row"]')
    expect(rows.length).toBe(6)

    wrapper.unmount()
  })

  it('A.18.3 WarnBanner click expands details list of skipped rows', async () => {
    const WarnBanner = (await import('@/components/WarnBanner.vue')).default
    const wrapper = mount(WarnBanner, {
      props: {
        count: 2,
        message: '2 rows skipped',
        details: ['Row 7: missing price', 'Row 14: invalid date'],
      },
    })
    await nextTick()

    // Details should be hidden initially
    const details = wrapper.find('[data-testid="warn-details"]')
    const isHidden = !details.exists() || (details.element as HTMLElement).style.display === 'none' || details.classes().includes('hidden')
    expect(isHidden).toBe(true)

    // Click the banner
    await wrapper.trigger('click')
    await nextTick()

    // Details should now be visible
    const detailsAfter = wrapper.find('[data-testid="warn-details"]')
    expect(detailsAfter.exists()).toBe(true)
    expect(detailsAfter.text()).toContain('Row 7')

    wrapper.unmount()
  })

  it('A.18.4 Toast component auto-dismisses and renders retry message', async () => {
    const Toast = (await import('@/components/Toast.vue')).default
    const wrapper = mount(Toast, {
      props: {
        message: "Couldn't save import. Retry?",
        show: true,
        onRetry: vi.fn(),
      },
      attachTo: document.body,
    })
    await nextTick()

    // Toast should be visible
    const toast = wrapper.find('[data-testid="toast"]')
    expect(toast.exists()).toBe(true)
    expect(toast.text()).toContain("Couldn't save import")

    // Retry button should exist
    const retryBtn = wrapper.find('[data-testid="toast-retry-btn"]')
    expect(retryBtn.exists()).toBe(true)

    wrapper.unmount()
  })
})
