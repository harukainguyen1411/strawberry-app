/**
 * A.3 — FX loader tests (Refs V0.5)
 *
 * Implementation commit: all tests flipped from it.fails() to it().
 */

import { describe, it, expect, vi } from 'vitest'
import { loadFx } from '../fx.js'

describe('A.3 — FX loader', () => {
  it('A.3.1 loadFx returns rates + overrides + updatedAt when doc exists', async () => {
    const updatedAt = new Date('2026-04-19')
    const mockData = {
      rates: { 'USD->EUR': 0.92, 'EUR->USD': 1.087 },
      overrides: {},
      updatedAt: { toDate: () => updatedAt },
    }
    const mockDb = makeMockDb(mockData)
    const result = await loadFx('u1', mockDb)
    expect(result.rates).toEqual({ 'USD->EUR': 0.92, 'EUR->USD': 1.087 })
    expect(result.overrides).toEqual({})
  })

  it('A.3.2 loadFx exposes overrides unmerged (merging is convert()\'s job)', async () => {
    const mockData = {
      rates: { 'USD->EUR': 0.92 },
      overrides: { 'USD->EUR': 0.93 },
      updatedAt: { toDate: () => new Date() },
    }
    const mockDb = makeMockDb(mockData)
    const result = await loadFx('u1', mockDb)
    expect(result.rates['USD->EUR']).toBe(0.92)
    expect(result.overrides?.['USD->EUR']).toBe(0.93)
  })

  it('A.3.3 loadFx returns seed defaults + warns when meta/fx missing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const mockDb = makeMissingDb()
    const result = await loadFx('u1', mockDb)
    expect(result.rates).toBeDefined()
    expect(Object.keys(result.rates).length).toBeGreaterThan(0)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('meta/fx missing'))
    warnSpy.mockRestore()
  })

  it('A.3.4 loadFx returns partial doc even if some rate keys are missing', async () => {
    const mockData = {
      rates: { 'USD->EUR': 0.92 },
      updatedAt: { toDate: () => new Date() },
    }
    const mockDb = makeMockDb(mockData)
    const result = await loadFx('u1', mockDb)
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
