/**
 * A.6 — Tool surface enumeration (Refs V0.4)
 *
 * Implementation commit: all tests flipped from it.fails() to it().
 *
 * EXPECTED_TOOLS is canonical — pulled from ADR §7 tool surface list.
 */

import { describe, it, expect } from 'vitest'

/** Canonical tool list from ADR §7 — do not modify without updating the ADR. */
const EXPECTED_TOOLS = [
  // Read-only
  'portfolio_get_snapshot',
  'portfolio_get_trades',
  'portfolio_get_intents',
  'portfolio_get_digests',
  'portfolio_get_snapshot_history',
  // Write
  'portfolio_create_intent',
  'portfolio_update_intent',
  'portfolio_delete_intent',
  'portfolio_set_sizing_rule',
  'portfolio_trigger_refresh',
  'portfolio_set_fx_override',
  'portfolio_mark_trade_matched',
  // External lookup
  'portfolio_news_for_tickers',
  // v0 in-scope
  'portfolio_set_base_currency',
  'portfolio_import_csv',
] as const

describe('A.6 — portfolio-tools surface', () => {
  it('A.6.1 every tool name from ADR §7 is exported as a function', async () => {
    const handlers = await import('../index.js')
    for (const name of EXPECTED_TOOLS) {
      expect(typeof (handlers as Record<string, unknown>)[name]).toBe('function')
    }
  })

  it('A.6.2 every v1+ stub tool throws NotImplementedError when called', async () => {
    const handlers = await import('../index.js')
    const v1PlusTools = [
      'portfolio_get_intents',
      'portfolio_get_digests',
      'portfolio_get_snapshot_history',
      'portfolio_create_intent',
      'portfolio_update_intent',
      'portfolio_delete_intent',
      'portfolio_set_sizing_rule',
      'portfolio_trigger_refresh',
      'portfolio_set_fx_override',
      'portfolio_mark_trade_matched',
      'portfolio_news_for_tickers',
    ] as const
    for (const name of v1PlusTools) {
      const fn = (handlers as Record<string, unknown>)[name] as (ctx: unknown) => unknown
      await expect(Promise.resolve().then(() => fn({}))).rejects.toMatchObject({
        message: expect.stringMatching(/not implemented|v1/i),
      })
    }
  })

  it('A.6.3 v0 in-scope tools do not throw NotImplementedError', async () => {
    const handlers = await import('../index.js')
    const v0Tools = [
      'portfolio_get_snapshot',
      'portfolio_get_trades',
      'portfolio_set_base_currency',
      'portfolio_import_csv',
    ] as const
    for (const name of v0Tools) {
      const fn = (handlers as Record<string, unknown>)[name] as (ctx: unknown) => unknown
      // Should not throw NotImplementedError (may throw other errors, that's OK)
      let threw = false
      try {
        await fn({})
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        threw = /not implemented|v1/i.test(msg)
      }
      expect(threw).toBe(false)
    }
  })

  it('A.6.4 no extra exports and no missing exports vs EXPECTED_TOOLS', async () => {
    const handlers = await import('../index.js')
    const exported = Object.keys(handlers as Record<string, unknown>).filter(
      (k) => typeof (handlers as Record<string, unknown>)[k] === 'function'
    )
    const expected = [...EXPECTED_TOOLS].sort()
    expect(exported.sort()).toEqual(expected)
  })
})
