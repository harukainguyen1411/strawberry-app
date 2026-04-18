/**
 * import.ts — portfolio_import_csv handler orchestration.
 *
 * Wires parsers (V0.6 T212, V0.7 IB) to idempotent Firestore commits.
 * Idempotency: broker-assigned trade ID as Firestore doc ID under
 * users/{uid}/trades/{tradeId}. Re-importing skips existing docs.
 *
 * Refs V0.8
 */

import { parseT212Csv } from './portfolio-tools/csv/t212.js'
import { parseIbCsv } from './portfolio-tools/csv/ib.js'
import type { ImportResult } from './portfolio-tools/types.js'

interface ImportCsvParams {
  uid: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any
  source: 'T212' | 'IB'
  csv: string
}

function makeHttpsError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code })
}

/**
 * importCsv — parse CSV and commit trades/positions/cash to Firestore.
 *
 * Idempotency rules (ADR §5):
 * - New trade (broker ID not in trades/) → insert
 * - Existing trade (broker ID match) → skip (immutability)
 * - Positions → overwrite (not append)
 * - Cash → overwrite per broker
 */
export async function importCsv(params: ImportCsvParams): Promise<ImportResult> {
  const { uid, db, source, csv } = params

  if (!uid) {
    throw makeHttpsError('unauthenticated', 'Request must be authenticated')
  }

  if (source !== 'T212' && source !== 'IB') {
    throw makeHttpsError('invalid-argument', `Unknown source: ${source}. Must be 'T212' or 'IB'`)
  }

  // Parse CSV
  const parsed = source === 'T212' ? parseT212Csv(csv) : parseIbCsv(csv)

  // If parse completely failed (bad headers), return without writing
  if (parsed.errors.length > 0 && parsed.trades.length === 0 && parsed.positions.length === 0) {
    return {
      tradesAdded: 0,
      tradesSkipped: 0,
      positionsWritten: 0,
      errors: parsed.errors,
    }
  }

  const userRef = db.collection('users').doc(uid)
  let tradesAdded = 0
  let tradesSkipped = 0

  // Write trades idempotently
  for (const trade of parsed.trades) {
    const tradeRef = userRef.collection('trades').doc(trade.id)
    const existing = await tradeRef.get()

    if (existing.exists) {
      tradesSkipped++
      continue
    }

    await tradeRef.set({
      ...trade,
      id: undefined, // id is the doc key, not a field
      executedAt: trade.executedAt,
    })
    tradesAdded++
  }

  // Write positions (overwrite — materialized view)
  for (const position of parsed.positions) {
    const posRef = userRef.collection('positions').doc(position.ticker)
    await posRef.set(position)
  }

  // Write cash (overwrite per broker — placeholder at v0; real balance from broker API in v1).
  // currency is derived from the CSV (T212: Currency (Total) column; IB: Cash Report section).
  // null means the CSV did not expose account currency — DashboardView will surface a warn-banner.
  const cashRef = userRef.collection('cash').doc(source)
  await cashRef.set({
    broker: source,
    currency: parsed.accountCurrency ?? null, // NOT POPULATED if null — see V0.17 warn-banner
    amount: 0,  // placeholder — real cash from broker API in v1
    updatedAt: new Date(),
  })

  return {
    tradesAdded,
    tradesSkipped,
    positionsWritten: parsed.positions.length,
    errors: parsed.errors,
  }
}
