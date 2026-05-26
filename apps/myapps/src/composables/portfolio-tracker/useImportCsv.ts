/**
 * useImportCsv — wraps the importCsv Cloud Function callable.
 * Refs V0.12
 *
 * NOTE: V0.8 implemented functions/import.ts but did not yet expose it via
 * functions/index.ts as `importCsv`. Add the export there for the runtime
 * round-trip to work; the unit tests mock this composable so they pass today.
 */

import { ref, type Ref } from 'vue'
import { getFunctions, httpsCallable } from 'firebase/functions'
import type { CsvSource } from './useCsvParser'
import type { ImportResult } from '../../../portfolio-tracker/functions/portfolio-tools/types.js'

export interface UseImportCsvReturn {
  importCsv: (source: CsvSource, csv: string) => Promise<ImportResult>
  loading: Ref<boolean>
  error: Ref<string | null>
}

export function useImportCsv(): UseImportCsvReturn {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function importCsv(source: CsvSource, csv: string): Promise<ImportResult> {
    loading.value = true
    error.value = null
    try {
      const callable = httpsCallable<
        { source: CsvSource; csv: string },
        ImportResult
      >(getFunctions(), 'importCsv')
      const result = await callable({ source, csv })
      return result.data
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      error.value = message
      throw err
    } finally {
      loading.value = false
    }
  }

  return { importCsv, loading, error }
}
