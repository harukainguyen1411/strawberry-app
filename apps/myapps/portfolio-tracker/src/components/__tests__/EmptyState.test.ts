/**
 * V0.16 — EmptyState (reusable).
 *
 * Per design spec §5.1: shown on `/` when user has zero positions and
 * zero trades. Reusable primitive: props `icon, title, body, ctaLabel,
 * ctaTo`. CTA links to `/import` in the dashboard's empty case.
 *
 * Refs V0.16
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import EmptyState from '@/components/EmptyState.vue'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/import', component: { template: '<div />' } },
    ],
  })
}

describe('V0.16 — EmptyState', () => {
  it('renders icon, title, and body', async () => {
    const router = makeRouter()
    const wrapper = mount(EmptyState, {
      global: { plugins: [router] },
      props: {
        icon: '🍓',
        title: 'No portfolio data yet',
        body: 'Import a CSV to get started.',
        ctaLabel: 'Import CSV →',
        ctaTo: '/import',
      },
    })
    const text = wrapper.text()
    expect(text).toContain('🍓')
    expect(text).toContain('No portfolio data yet')
    expect(text).toContain('Import a CSV to get started.')
  })

  it('renders the CTA as a router-link to ctaTo', async () => {
    const router = makeRouter()
    const wrapper = mount(EmptyState, {
      global: { plugins: [router] },
      props: {
        icon: '🍓',
        title: 'No portfolio data yet',
        body: 'Import a CSV to get started.',
        ctaLabel: 'Import CSV →',
        ctaTo: '/import',
      },
    })
    const link = wrapper.find('a[href="/import"]')
    expect(link.exists()).toBe(true)
    expect(link.text()).toBe('Import CSV →')
  })

  it('renders the title as an H2 (semantic heading)', async () => {
    const router = makeRouter()
    const wrapper = mount(EmptyState, {
      global: { plugins: [router] },
      props: {
        icon: '🍓',
        title: 'No portfolio data yet',
        body: 'Import a CSV to get started.',
        ctaLabel: 'Import CSV →',
        ctaTo: '/import',
      },
    })
    const h2 = wrapper.find('h2')
    expect(h2.exists()).toBe(true)
    expect(h2.text()).toBe('No portfolio data yet')
  })
})
