/**
 * A.3 — FX loader tests (Refs V0.5)
 *
 * xfail-first: all tests use it.fails() until implementation lands.
 * A.3.1–A.3.4 use a mock Firestore db (no real emulator needed for unit tests).
 */

import { describe, it, expect, vi } from 'vitest'

describe('A.3 — FX loader', () => {
  it.fails('A.3.1 loadFx returns rates + overrides + updatedAt when doc exists', async () => {
    const { loadFx } = await import('../fx.js')
    const mockData = {
      rates: { 'USD->EUR': 0.92, 'EUR->USD': 1.087 },
      overrides: {},
      updatedAt: new Date('2026-04-19'),
    }
    const mockDb = makeMockDb(mockData)
    const result = await loadFx('u1', mockDb)
    expect(result.rates).toEqual(mockData.rates)
    expect(result.overrides).toEqual({})
  })

  it.fails('A.3.2 loadFx exposes overrides unmerged (merging is convert()\'s job)', async () => {
    const { loadFx } = await import('../fx.js')
    const mockData = {
      rates: { 'USD->EUR': 0.92 },
      overrides: { 'USD->EUR': 0.93 },
      updatedAt: new Date('2026-04-19'),
    }
    const mockDb = makeMockDb(mockData)
    const result = await loadFx('u1', mockDb)
    expect(result.rates['USD->EUR']).toBe(0.92)
    expect(result.overrides?.['USD->EUR']).toBe(0.93)
  })

  it.fails('A.3.3 loadFx returns seed defaults + warns when meta/fx missing', async () => {
    const { loadFx } = await import('../fx.js')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const mockDb = makeMissingDb()
    const result = await loadFx('u1', mockDb)
    expect(result.rates).toBeDefined()
    expect(Object.keys(result.rates).length).toBeGreaterThan(0)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('meta/fx missing'))
    warnSpy.mockRestore()
  })

  it.fails('A.3.4 loadFx returns partial doc even if some rate keys are missing', async () => {
    const { loadFx } = await import('../fx.js')
    const mockData = { rates: { 'USD->EUR': 0.92 }, updatedAt: new Date() }
    const mockDb = makeMockDb(mockData)
    const result = await loadFx('u1', mockDb)
    // Returns what is there; convert() is responsible for missing-rate errors
    expect(result.rates['USD->EUR']).toBe(0.92)
    expect(result.rates['EUR->USD']).toBeUndefined()
  })
})

function makeMockDb(data: Record<string, unknown>) {
  return {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => data,
            }),
          }),
        }),
      }),
    }),
  }
}

function makeMissingDb() {
  return {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              exists: false,
              data: () => null,
            }),
          }),
        }),
      }),
    }),
  }
}
