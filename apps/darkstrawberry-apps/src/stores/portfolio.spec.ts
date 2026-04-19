import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePortfolioStore } from './portfolio'
import type { StockHolding } from '@/firebase/firestore'
import type { Transaction } from '@/firebase/firestore'

const mockGetStockHoldings = vi.fn()
const mockGetTransactions = vi.fn()
const mockGetPortfolioAccount = vi.fn()
const mockUpdateStockHolding = vi.fn()

vi.mock('@/storage/localStorage', () => ({
  getStockHoldings: (...args: unknown[]) => mockGetStockHoldings(...args),
  addStockHolding: vi.fn(),
  updateStockHolding: (...args: unknown[]) => mockUpdateStockHolding(...args),
  deleteStockHolding: vi.fn(),
  getTransactions: (...args: unknown[]) => mockGetTransactions(...args),
  addTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  getPortfolioAccount: (...args: unknown[]) => mockGetPortfolioAccount(...args),
  setPortfolioAccount: vi.fn(),
  updatePortfolioAccount: vi.fn()
}))

describe('portfolio store – manual current price (#40)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPortfolioAccount.mockResolvedValue({ totalInvested: 0, cash: 0 })
    setActivePinia(createPinia())
  })

  it('uses holding.currentPrice when set (manual tracking)', async () => {
    const holdings: StockHolding[] = [
      {
        id: 'h1',
        symbol: 'AAPL',
        quantity: 10,
        averagePrice: 150,
        currentPrice: 165
      }
    ]
    mockGetStockHoldings.mockResolvedValue(holdings)
    mockGetTransactions.mockResolvedValue([])

    const store = usePortfolioStore()
    await store.fetchHoldings()
    await store.fetchTransactions()

    const withPrices = store.holdingsWithPrices
    expect(withPrices).toHaveLength(1)
    expect(withPrices[0].currentPrice).toBe(165)
    expect(withPrices[0].averagePrice).toBe(150)
  })

  it('falls back to last buy price when holding has no currentPrice', async () => {
    const holdings: StockHolding[] = [
      { id: 'h1', symbol: 'AAPL', quantity: 20, averagePrice: 150 }
    ]
    const transactions: Transaction[] = [
      {
        id: 't1',
        type: 'buy',
        symbol: 'AAPL',
        quantity: 10,
        price: 200,
        date: { seconds: 1000 } as Transaction['date']
      },
      {
        id: 't2',
        type: 'buy',
        symbol: 'AAPL',
        quantity: 10,
        price: 100,
        date: { seconds: 2000 } as Transaction['date']
      }
    ]
    mockGetStockHoldings.mockResolvedValue(holdings)
    mockGetTransactions.mockResolvedValue(transactions)

    const store = usePortfolioStore()
    await store.fetchHoldings()
    await store.fetchTransactions()

    const withPrices = store.holdingsWithPrices
    expect(withPrices).toHaveLength(1)
    // Last buy (by date) is 2000 -> price 100
    expect(withPrices[0].currentPrice).toBe(100)
    expect(withPrices[0].averagePrice).toBe(150)
  })

  it('falls back to averagePrice when no currentPrice and no buy transactions', async () => {
    const holdings: StockHolding[] = [
      { id: 'h1', symbol: 'MSFT', quantity: 5, averagePrice: 300 }
    ]
    mockGetStockHoldings.mockResolvedValue(holdings)
    mockGetTransactions.mockResolvedValue([])

    const store = usePortfolioStore()
    await store.fetchHoldings()
    await store.fetchTransactions()

    const withPrices = store.holdingsWithPrices
    expect(withPrices).toHaveLength(1)
    expect(withPrices[0].currentPrice).toBe(300)
    expect(withPrices[0].averagePrice).toBe(300)
  })

  it('average price column reflects weighted average of buys', async () => {
    const holdings: StockHolding[] = [
      { id: 'h1', symbol: 'AAPL', quantity: 20, averagePrice: 150 }
    ]
    mockGetStockHoldings.mockResolvedValue(holdings)
    mockGetTransactions.mockResolvedValue([])

    const store = usePortfolioStore()
    await store.fetchHoldings()
    await store.fetchTransactions()

    const withPrices = store.holdingsWithPrices
    expect(withPrices[0].averagePrice).toBe(150)
    // (10*200 + 10*100)/(10+10) = 150
  })
})

describe('portfolio store – stock source (#31)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPortfolioAccount.mockResolvedValue({ totalInvested: 0, cash: 0 })
    setActivePinia(createPinia())
  })

  it('distinctSources returns sorted unique sources from transactions', async () => {
    const transactions: Transaction[] = [
      { id: 't1', type: 'buy', symbol: 'AAPL', quantity: 10, price: 150, date: { seconds: 1000 } as Transaction['date'], source: 'Trading 212' },
      { id: 't2', type: 'buy', symbol: 'MSFT', quantity: 5, price: 300, date: { seconds: 2000 } as Transaction['date'], source: 'Interactive Broker' },
      { id: 't3', type: 'buy', symbol: 'GOOG', quantity: 2, price: 140, date: { seconds: 3000 } as Transaction['date'], source: 'Trading 212' }
    ]
    mockGetStockHoldings.mockResolvedValue([])
    mockGetTransactions.mockResolvedValue(transactions)

    const store = usePortfolioStore()
    await store.fetchHoldings()
    await store.fetchTransactions()

    expect(store.distinctSources).toEqual(['Interactive Broker', 'Trading 212'])
  })

  it('distinctSources returns empty when no transactions have source', async () => {
    mockGetStockHoldings.mockResolvedValue([])
    mockGetTransactions.mockResolvedValue([
      { id: 't1', type: 'buy', symbol: 'AAPL', quantity: 10, price: 150, date: { seconds: 1000 } as Transaction['date'] }
    ])

    const store = usePortfolioStore()
    await store.fetchHoldings()
    await store.fetchTransactions()

    expect(store.distinctSources).toEqual([])
  })

  it('holdingsWithPrices includes source when holdings have source', async () => {
    const holdings: StockHolding[] = [
      { id: 'h1', symbol: 'AAPL', quantity: 10, averagePrice: 150, source: 'Trading 212' },
      { id: 'h2', symbol: 'AAPL', quantity: 5, averagePrice: 160, source: 'Interactive Broker' }
    ]
    mockGetStockHoldings.mockResolvedValue(holdings)
    mockGetTransactions.mockResolvedValue([])

    const store = usePortfolioStore()
    await store.fetchHoldings()
    await store.fetchTransactions()

    const withPrices = store.holdingsWithPrices
    expect(withPrices).toHaveLength(2)
    expect(withPrices.map(h => ({ symbol: h.symbol, source: h.source }))).toEqual(
      [{ symbol: 'AAPL', source: 'Trading 212' }, { symbol: 'AAPL', source: 'Interactive Broker' }]
    )
  })
})

describe('portfolio store – stock performance (#46)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPortfolioAccount.mockResolvedValue({ totalInvested: 10000, cash: 1000 })
    setActivePinia(createPinia())
  })

  it('computes stockPerformancePercent from average and current price', async () => {
    const holdings: StockHolding[] = [
      { id: 'h1', symbol: 'AAPL', quantity: 10, averagePrice: 150, currentPrice: 165 }
    ]
    mockGetStockHoldings.mockResolvedValue(holdings)
    mockGetTransactions.mockResolvedValue([])

    const store = usePortfolioStore()
    await store.fetchHoldings()
    await store.fetchTransactions()

    const withPrices = store.holdingsWithPrices
    expect(withPrices).toHaveLength(1)
    // (165 - 150) / 150 * 100 = 10%
    expect(withPrices[0].stockPerformancePercent).toBeCloseTo(10)
  })

  it('computes negative stockPerformancePercent for loss', async () => {
    const holdings: StockHolding[] = [
      { id: 'h2', symbol: 'MSFT', quantity: 5, averagePrice: 400, currentPrice: 360 }
    ]
    mockGetStockHoldings.mockResolvedValue(holdings)
    mockGetTransactions.mockResolvedValue([])

    const store = usePortfolioStore()
    await store.fetchHoldings()
    await store.fetchTransactions()

    const withPrices = store.holdingsWithPrices
    expect(withPrices).toHaveLength(1)
    // (360 - 400) / 400 * 100 = -10%
    expect(withPrices[0].stockPerformancePercent).toBeCloseTo(-10)
  })

  it('returns null stockPerformancePercent when averagePrice is 0', async () => {
    const holdings: StockHolding[] = [
      { id: 'h3', symbol: 'GOOG', quantity: 1, averagePrice: 0, currentPrice: 140 }
    ]
    mockGetStockHoldings.mockResolvedValue(holdings)
    mockGetTransactions.mockResolvedValue([])

    const store = usePortfolioStore()
    await store.fetchHoldings()
    await store.fetchTransactions()

    const withPrices = store.holdingsWithPrices
    expect(withPrices).toHaveLength(1)
    expect(withPrices[0].stockPerformancePercent).toBeNull()
  })
})
