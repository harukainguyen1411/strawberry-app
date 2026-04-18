/**
 * useCsvParser — client-side composable that delegates to the pure CSV parser
 * functions from portfolio-tools (V0.6 T212, V0.7 IB).
 *
 * The parsers live in functions/portfolio-tools/csv/ and are pure TypeScript
 * modules — no Firestore or runtime dependencies, so they can be imported
 * directly in the Vue app for client-side parsing before the import callable
 * (V0.8) is invoked.
 *
 * Refs V0.11
 */

import { ref, type Ref } from 'vue'
import type { Trade, Position, ImportError } from '@/../functions/portfolio-tools/types.js'

export type CsvSource = 'T212' | 'IB'

export interface ParseResult {
  trades: Trade[]
  positions: Position[]
  errors: ImportError[]
}

export interface UseCsvParserReturn {
  result: Ref<ParseResult | null>
  parseError: Ref<string | null>
  loading: Ref<boolean>
  parse: (source: CsvSource, text: string) => Promise<void>
  reset: () => void
}

export function useCsvParser(): UseCsvParserReturn {
  const result = ref<ParseResult | null>(null)
  const parseError = ref<string | null>(null)
  const loading = ref(false)

  async function parse(source: CsvSource, text: string): Promise<void> {
    loading.value = true
    parseError.value = null
    result.value = null

    try {
      if (source === 'T212') {
        const { parseT212Csv } = await import('@/../functions/portfolio-tools/csv/t212.js')
        result.value = parseT212Csv(text)
      } else if (source === 'IB') {
        const { parseIbCsv } = await import('@/../functions/portfolio-tools/csv/ib.js')
        result.value = parseIbCsv(text)
      } else {
        parseError.value = 'Unknown source. Please select T212 or IB.'
      }
    } catch (err) {
      parseError.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  function reset() {
    result.value = null
    parseError.value = null
    loading.value = false
  }

  return { result, parseError, loading, parse, reset }
}
