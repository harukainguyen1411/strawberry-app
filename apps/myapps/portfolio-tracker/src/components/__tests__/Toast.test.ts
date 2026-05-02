/**
 * V0.16 — Toast (auto-dismiss + a11y).
 *
 * Per design spec §5.5: 5s auto-dismiss; keeps preview state intact when
 * triggered from the V0.12 commit failure (covered in CsvImportStep2's
 * test). Per §8: announces via aria-live="polite", role="status".
 *
 * Refs V0.16
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Toast from '@/components/Toast.vue'

describe('V0.16 — Toast', () => {
  it('emits "dismiss" after 5 seconds with fake timers', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = mount(Toast, {
        props: { message: "Couldn't save import.", show: true },
      })
      expect(wrapper.emitted('dismiss')).toBeUndefined()
      await vi.advanceTimersByTimeAsync(4999)
      expect(wrapper.emitted('dismiss')).toBeUndefined()
      await vi.advanceTimersByTimeAsync(2)
      expect(wrapper.emitted('dismiss')).toEqual([[]])
    } finally {
      vi.useRealTimers()
    }
  })

  it('carries role="status" and aria-live="polite" for screen readers', () => {
    const wrapper = mount(Toast, {
      props: { message: 'hello', show: true },
    })
    const toast = wrapper.find('[data-testid="toast"]')
    expect(toast.exists()).toBe(true)
    expect(toast.attributes('role')).toBe('status')
    expect(toast.attributes('aria-live')).toBe('polite')
  })
})
