/**
 * portfolio-tools — shared handler module.
 *
 * This is the canonical API surface for the portfolio tracker. Every tool is
 * exported once from here and wired into three adapters:
 *   1. HTTPS callable (UI) — v1+
 *   2. MCP tool (Claude) — v2+
 *   3. Gemini function declaration (chat proxy) — v3+
 *
 * v0 in-scope tools have real bodies (or are completed in V0.5–V0.8).
 * v1+ tools are honest stubs that throw NotImplementedError.
 *
 * Tool-parity invariant (ADR §6.3): the tool list here MUST exactly match
 * ADR §7. Run the A.6.4 surface test to verify.
 */

import { notImplemented } from './_notImplemented.js'
import type { HandlerContext, ImportResult } from './types.js'

// ---------------------------------------------------------------------------
// v0 in-scope: read
// ---------------------------------------------------------------------------

/**
 * portfolio_get_snapshot — current positions + cash + totals.
 * v0: returns stub shape; full implementation in v1 when T212/IB adapters land.
 */
export async function portfolio_get_snapshot(ctx: HandlerContext) {
  // v0: real Firestore read will be wired in v1
  const { uid, db } = ctx
  const posSnap = await db.collection('users').doc(uid).collection('positions').get()
  const cashSnap = await db.collection('users').doc(uid).collection('cash').get()
  const positions = posSnap.docs.map((d: { data: () => unknown }) => ({ id: d.data(), ...d.data() }))
  const cash = cashSnap.docs.map((d: { data: () => unknown }) => d.data())
  return { positions, cash }
}

/**
 * portfolio_get_trades — filtered by range and optional ticker.
 * v0: returns raw Firestore docs without range filtering.
 */
export async function portfolio_get_trades(ctx: HandlerContext & { ticker?: string }) {
  const { uid, db, ticker } = ctx
  let ref = db.collection('users').doc(uid).collection('trades')
  if (ticker) {
    ref = ref.where('ticker', '==', ticker)
  }
  const snap = await ref.get()
  return snap.docs.map((d: { id: string; data: () => unknown }) => ({ id: d.id, ...d.data() }))
}

// ---------------------------------------------------------------------------
// v0 in-scope: write
// ---------------------------------------------------------------------------

/**
 * portfolio_set_base_currency — sets users/{uid}.baseCurrency.
 * Validates the value is USD or EUR. Used by the BaseCurrencyPicker modal.
 */
export async function portfolio_set_base_currency(
  ctx: HandlerContext & { baseCurrency: unknown }
): Promise<void> {
  const { uid, db, baseCurrency } = ctx
  if (baseCurrency !== 'USD' && baseCurrency !== 'EUR') {
    const err = new Error(`invalid-argument: baseCurrency must be 'USD' or 'EUR', got '${baseCurrency}'`)
    ;(err as Error & { code: string }).code = 'invalid-argument'
    throw err
  }
  await db.collection('users').doc(uid).set({ baseCurrency }, { merge: true })
}

/**
 * portfolio_import_csv — orchestrates CSV import (parse + Firestore commit).
 * Real parsing + commit logic lives in import.ts (V0.8). This stub delegates.
 */
export async function portfolio_import_csv(
  _ctx: HandlerContext & { source: string; csv: string }
): Promise<ImportResult> {
  // Full implementation in V0.8 — this stub compiles the surface only
  return {
    tradesAdded: 0,
    tradesSkipped: 0,
    positionsWritten: 0,
    errors: [],
  }
}

// ---------------------------------------------------------------------------
// v1+ stubs — throw NotImplementedError
// ---------------------------------------------------------------------------

export const portfolio_get_intents = notImplemented('v1')
export const portfolio_get_digests = notImplemented('v1')
export const portfolio_get_snapshot_history = notImplemented('v1')
export const portfolio_create_intent = notImplemented('v1')
export const portfolio_update_intent = notImplemented('v1')
export const portfolio_delete_intent = notImplemented('v1')
export const portfolio_set_sizing_rule = notImplemented('v1')
export const portfolio_trigger_refresh = notImplemented('v1')
export const portfolio_set_fx_override = notImplemented('v1')
export const portfolio_mark_trade_matched = notImplemented('v1')
export const portfolio_news_for_tickers = notImplemented('v1')
