import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { importCsv as importCsvHandler } from './import.js'
import { importT212Pdf as importT212PdfHandler } from './importT212Pdf.js'
import type { ImportResult } from './portfolio-tools/types.js'

// Subpath imports — see onSignIn.ts for why `import * as admin from
// 'firebase-admin'` breaks under ESM at runtime.
if (!getApps().length) {
  initializeApp()
}

export { onSignIn } from './onSignIn.js'

interface ImportCsvData {
  source: 'T212' | 'IB'
  csv: string
}

// V0.8 — HTTPS callable wrapper around the importCsv orchestrator in import.ts.
// The orchestrator throws plain Error objects with `code` properties so it stays
// transport-agnostic; this wrapper translates them to HttpsError so the client
// receives proper Firebase callable error codes.
export const importCsv = onCall<ImportCsvData>(
  async (request: CallableRequest<ImportCsvData>): Promise<ImportResult> => {
    const uid = request.auth?.uid
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Request must be authenticated')
    }

    if (!request.data || typeof request.data !== 'object') {
      throw new HttpsError('invalid-argument', 'Request data is required')
    }
    const { source, csv } = request.data
    if (typeof csv !== 'string' || csv.length === 0) {
      throw new HttpsError('invalid-argument', '`csv` must be a non-empty string')
    }
    if (source !== 'T212' && source !== 'IB') {
      throw new HttpsError('invalid-argument', "`source` must be 'T212' or 'IB'")
    }

    try {
      const db = getFirestore()
      return await importCsvHandler({ uid, db, source, csv })
    } catch (err: unknown) {
      if (err instanceof HttpsError) throw err
      // Defense-in-depth: forward known orchestrator codes verbatim. The
      // 'unauthenticated' branch is unreachable today (caller is gated above)
      // but kept so future orchestrator-side auth checks surface correctly.
      const code = (err as { code?: string }).code
      const message = err instanceof Error ? err.message : 'Unknown error'
      if (code === 'unauthenticated' || code === 'invalid-argument') {
        throw new HttpsError(code, message)
      }
      throw new HttpsError('internal', message)
    }
  },
)

// V0.1.0 — HTTPS callable for T212 Activity Statement PDF import.
// Accepts a base64-encoded PDF buffer. Parses positions/cash/fx atomically.
// PDF buffer is transmitted as base64 string (callable data is JSON; binary
// buffers must be encoded). Client encodes via FileReader.readAsDataURL or
// ArrayBuffer → base64.
export const importT212Pdf = onCall<{ pdfBase64: string }>(
  async (request: CallableRequest<{ pdfBase64: string }>): Promise<ImportResult> => {
    const uid = request.auth?.uid
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Request must be authenticated')
    }

    if (!request.data || typeof request.data !== 'object') {
      throw new HttpsError('invalid-argument', 'Request data is required')
    }
    const { pdfBase64 } = request.data
    if (typeof pdfBase64 !== 'string' || pdfBase64.length === 0) {
      throw new HttpsError('invalid-argument', '`pdfBase64` must be a non-empty string')
    }

    // Decode base64 to Buffer (strips data-URL prefix if present)
    const base64Data = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64
    const pdfBuffer = Buffer.from(base64Data, 'base64')

    try {
      const db = getFirestore()
      return await importT212PdfHandler({ uid, db, pdfBuffer })
    } catch (err: unknown) {
      if (err instanceof HttpsError) throw err
      const code = (err as { code?: string }).code
      const message = err instanceof Error ? err.message : 'Unknown error'
      if (code === 'unauthenticated' || code === 'invalid-argument') {
        throw new HttpsError(code, message)
      }
      throw new HttpsError('internal', message)
    }
  },
)
