/**
 * importT212Pdf.ts — T212 Activity Statement PDF import handler.
 *
 * Parses a T212 Activity Statement PDF buffer and atomically writes to Firestore:
 *   - users/{uid}/positions/* — full replace (delete existing, set new)
 *   - users/{uid}/cash/T212   — set (derived: account_value − sum positions EUR value)
 *   - users/{uid}/meta/fx     — merge (per-row FX rates seeded)
 *
 * Uses a Firestore batch for atomicity: all-or-nothing. Parse errors abort before
 * any write. No trades are written — PDF snapshot data is positions/cash/fx only.
 *
 * Architectural choice: separate handler (not extending importCsv) to keep
 * concerns distinct. The PDF callable path is structurally different from the
 * CSV path: binary buffer in, snapshot out; no trade idempotency needed.
 *
 * Refs V0.1.0
 */

import { parseT212StatementPdf, T212PdfError } from './portfolio-tools/t212-pdf.js'
import type { ImportResult, ImportError } from './portfolio-tools/types.js'

interface ImportT212PdfParams {
  uid: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any
  pdfBuffer: Buffer
}

function makeHttpsError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code })
}

/**
 * importT212Pdf — parse PDF and atomically commit positions/cash/fx to Firestore.
 *
 * Returns ImportResult with positionsWritten count and any errors.
 * On parse failure (not_pdf, etc.), returns errors array without writing.
 */
export async function importT212Pdf(params: ImportT212PdfParams): Promise<ImportResult> {
  const { uid, db, pdfBuffer } = params

  if (!uid) {
    throw makeHttpsError('unauthenticated', 'Request must be authenticated')
  }

  // --- Parse PDF ---
  let parsed: Awaited<ReturnType<typeof parseT212StatementPdf>>
  try {
    parsed = await parseT212StatementPdf(pdfBuffer)
  } catch (err: unknown) {
    if (err instanceof T212PdfError) {
      const importError: ImportError = {
        kind: err.kind,
        message: err.message,
      }
      return {
        tradesAdded: 0,
        tradesSkipped: 0,
        positionsWritten: 0,
        errors: [importError],
      }
    }
    throw err
  }

  const userRef = db.collection('users').doc(uid)

  // --- Atomic batch write ---
  // Step 1: get existing positions to delete them (full replace)
  const existingPositions = await userRef.collection('positions').get()

  // Step 2: build batch
  const batch = db.batch()

  // Delete all existing positions (full replace)
  for (const doc of existingPositions.docs) {
    batch.delete(doc.ref)
  }

  // Write new positions
  for (const position of parsed.positions) {
    const posRef = userRef.collection('positions').doc(position.ticker)
    batch.set(posRef, {
      ...position,
      updatedAt: new Date(),
    })
  }

  // Write cash (derived: account_value − sum positions EUR)
  const cashRef = userRef.collection('cash').doc('T212')
  batch.set(cashRef, {
    broker: 'T212',
    currency: 'EUR',
    amount: parsed.cash.amount,
    updatedAt: new Date(),
  })

  // Merge FX rates into meta/fx — preserve existing pairs (merge semantics)
  if (Object.keys(parsed.fxRates).length > 0) {
    const fxRef = userRef.collection('meta').doc('fx')
    // We must merge the rates sub-field, not overwrite the whole document.
    // Firestore's merge: true merges at document level, not nested.
    // Strategy: read existing, merge, set. This is safe because the PDF is
    // the only writer of these FX pairs (USD->EUR) and the operation is
    // within a single coordinator session.
    const existingFx = await fxRef.get()
    const existingRates = (existingFx.data()?.rates as Record<string, number>) ?? {}
    const mergedRates: Record<string, number> = { ...existingRates, ...parsed.fxRates }
    batch.set(fxRef, {
      ...(existingFx.data() ?? {}),
      rates: mergedRates,
      updatedAt: new Date(),
    })
  }

  await batch.commit()

  return {
    tradesAdded: 0,
    tradesSkipped: 0,
    positionsWritten: parsed.positions.length,
    errors: [],
  }
}
