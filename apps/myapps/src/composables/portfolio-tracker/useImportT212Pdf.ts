/**
 * useImportT212Pdf — wraps the importT212Pdf Cloud Function callable.
 *
 * Exports:
 *   - useImportT212Pdf(): composable with importT212Pdf(bytes) + loading + error
 *   - detectFileFormat(bytes): 'pdf' | 'csv' | 'unsupported' — byte-level detection
 *
 * Format detection uses magic bytes, not file extension:
 *   %PDF (25 50 44 46) → 'pdf'
 *   D0 CF 11 E0       → 'unsupported' (XLS compound document)
 *   PK (50 4B 03 04)  → 'unsupported' (XLSX / ZIP)
 *   anything else     → 'csv'
 *
 * Refs V0.1.0
 */

import { ref, type Ref } from 'vue'
import { getFunctions, httpsCallable } from 'firebase/functions'
import type { ImportResult } from '../../../portfolio-tracker/functions/portfolio-tools/types.js'

export type FileFormat = 'pdf' | 'csv' | 'unsupported'

/**
 * detectFileFormat — inspect the first bytes of a file to determine its format.
 * Does NOT trust file extension.
 *
 * @param bytes - First bytes of the file (at minimum 4 bytes recommended)
 * @returns 'pdf' | 'csv' | 'unsupported'
 */
export function detectFileFormat(bytes: Uint8Array): FileFormat {
  if (bytes.length >= 4) {
    // %PDF magic
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return 'pdf'
    }
    // XLS: Compound Document Header (D0 CF 11 E0)
    if (bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0) {
      return 'unsupported'
    }
    // XLSX / ZIP (PK): 50 4B 03 04
    if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
      return 'unsupported'
    }
  }
  // Default: treat as CSV (text)
  return 'csv'
}

export interface UseImportT212PdfReturn {
  importT212Pdf: (pdfBytes: Uint8Array) => Promise<ImportResult>
  loading: Ref<boolean>
  error: Ref<string | null>
}

export function useImportT212Pdf(): UseImportT212PdfReturn {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function importT212Pdf(pdfBytes: Uint8Array): Promise<ImportResult> {
    loading.value = true
    error.value = null
    try {
      // Encode to base64 for JSON transport (callable data must be JSON-serializable).
      // Chunk the Uint8Array to avoid exceeding the JS call stack limit — spreading
      // large arrays into String.fromCharCode(...bytes) fails for files > ~64 KB.
      const CHUNK = 8192
      let binary = ''
      for (let i = 0; i < pdfBytes.length; i += CHUNK) {
        binary += String.fromCharCode(...pdfBytes.subarray(i, i + CHUNK))
      }
      const pdfBase64 = btoa(binary)

      const callable = httpsCallable<{ pdfBase64: string }, ImportResult>(
        getFunctions(),
        'importT212Pdf',
      )
      const result = await callable({ pdfBase64 })
      return result.data
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      error.value = message
      throw err
    } finally {
      loading.value = false
    }
  }

  return { importT212Pdf, loading, error }
}
