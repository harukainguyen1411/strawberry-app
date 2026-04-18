/**
 * useCsvParser — stub for V0.11 xfail.
 * Full implementation in V0.11 implementation commit.
 * Refs V0.11
 */

export type CsvSource = 'T212' | 'IB'

export interface ParseResult {
  trades: unknown[]
  positions: unknown[]
  errors: Array<{ row: number; reason: string }>
}

export function useCsvParser(_source: CsvSource, _text: string): {
  parse: () => ParseResult | null
  result: { value: ParseResult | null }
  error: { value: string | null }
  loading: { value: boolean }
} {
  throw new Error('not implemented — V0.11')
}
