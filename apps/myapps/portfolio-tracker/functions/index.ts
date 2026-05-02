import * as admin from 'firebase-admin'
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { importCsv as importCsvHandler } from './import.js'
import type { ImportResult } from './portfolio-tools/types.js'

if (!admin.apps.length) {
  admin.initializeApp()
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
export const importCsv = onCall<ImportCsvData, Promise<ImportResult>>(
  async (request: CallableRequest<ImportCsvData>) => {
    const uid = request.auth?.uid
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Request must be authenticated')
    }

    const { source, csv } = request.data ?? ({} as ImportCsvData)
    if (typeof csv !== 'string' || csv.length === 0) {
      throw new HttpsError('invalid-argument', '`csv` must be a non-empty string')
    }
    if (source !== 'T212' && source !== 'IB') {
      throw new HttpsError('invalid-argument', "`source` must be 'T212' or 'IB'")
    }

    try {
      const db = admin.firestore()
      return await importCsvHandler({ uid, db, source, csv })
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
