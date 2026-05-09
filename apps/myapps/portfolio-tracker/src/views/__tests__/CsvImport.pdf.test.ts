/**
 * CsvImport PDF integration — V0.1.0 xfail-first then impl.
 *
 * Tests:
 *   1. Format auto-detection: first 4 bytes %PDF → PDF route
 *   2. Format auto-detection: non-PDF bytes → CSV route
 *   3. XLS/XLSX → user-friendly "unsupported" error
 *   4. CsvImport title updated to "Import portfolio"
 *   5. CsvImport body copy updated as specified
 *   6. DropZone accepts .pdf
 *
 * Refs V0.1.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Path intentionally deferred so vite doesn't resolve at transform time.
// The module does not exist yet (xfail phase); dynamic import at runtime
// is caught by it.fails(). Once the module exists, convert to it().
const IMPORT_T212_PDF = '@/composables/useImportT212Pdf'

// ----- Format detection unit tests (pure function) -----
// These test the detectFormat helper exported from useImportT212Pdf.

describe('V0.1.0 — format auto-detection (detectFileFormat)', () => {
  it.fails('FMT-01 %PDF magic → "pdf"', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { detectFileFormat } = await import(/* @vite-ignore */ IMPORT_T212_PDF) as any
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]) // %PDF-
    expect(detectFileFormat(pdfBytes)).toBe('pdf')
  })

  it.fails('FMT-02 CSV bytes → "csv"', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { detectFileFormat } = await import(/* @vite-ignore */ IMPORT_T212_PDF) as any
    const csvBytes = new TextEncoder().encode('Action,Time,ISIN\n')
    expect(detectFileFormat(csvBytes)).toBe('csv')
  })

  it.fails('FMT-03 XLS magic (D0 CF 11 E0) → "unsupported"', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { detectFileFormat } = await import(/* @vite-ignore */ IMPORT_T212_PDF) as any
    const xlsBytes = new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1])
    expect(detectFileFormat(xlsBytes)).toBe('unsupported')
  })

  it.fails('FMT-04 XLSX magic (PK\\x03\\x04) → "unsupported"', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { detectFileFormat } = await import(/* @vite-ignore */ IMPORT_T212_PDF) as any
    const xlsxBytes = new Uint8Array([0x50, 0x4B, 0x03, 0x04]) // PK zip header
    expect(detectFileFormat(xlsxBytes)).toBe('unsupported')
  })
})

// ----- useImportT212Pdf composable -----

describe('V0.1.0 — useImportT212Pdf composable', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it.fails('COMP-01 importT212Pdf callable is called with base64-encoded PDF', async () => {
    // Mock firebase/functions
    const mockCallable = vi.fn().mockResolvedValue({ data: { positionsWritten: 13, errors: [], tradesAdded: 0, tradesSkipped: 0 } })
    vi.doMock('firebase/functions', () => ({
      getFunctions: vi.fn().mockReturnValue({}),
      httpsCallable: vi.fn().mockReturnValue(mockCallable),
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { useImportT212Pdf } = await import(/* @vite-ignore */ IMPORT_T212_PDF) as any
    const { importT212Pdf } = useImportT212Pdf()

    // Create a fake PDF buffer
    const fakePdf = new Uint8Array([0x25, 0x50, 0x44, 0x46])
    const result = await importT212Pdf(fakePdf)

    expect(mockCallable).toHaveBeenCalledOnce()
    const callArgs = mockCallable.mock.calls[0][0] as { pdfBase64: string }
    expect(typeof callArgs.pdfBase64).toBe('string')
    expect(callArgs.pdfBase64.length).toBeGreaterThan(0)
    expect(result.positionsWritten).toBe(13)
  })
})
