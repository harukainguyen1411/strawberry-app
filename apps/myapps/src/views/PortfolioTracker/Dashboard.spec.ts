import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithProviders } from '@/test/utils'
import Dashboard from './Dashboard.vue'

const mockFetchHoldings = vi.fn()
const mockFetchTransactions = vi.fn()
const mockFetchAccount = vi.fn()

const defaultMockStore = {
  holdings: [] as { id?: string; symbol: string; source?: string }[],
  holdingsWithPrices: [] as { id?: string; symbol: string; navPercent: number; stockPerformancePercent: number | null }[],
  totalCash: 5000,
  totalPortfolioValue: 5000,
  totalInvested: 0,
  loading: false,
  baseCurrency: 'USD' as const,
  fetchHoldings: mockFetchHoldings,
  fetchTransactions: mockFetchTransactions,
  fetchAccount: mockFetchAccount,
  updateStockPrice: vi.fn(),
  updateHoldingCurrentPrice: vi.fn()
}

const mockStoreWithHoldings = {
  holdings: [{ id: 'h1', symbol: 'AAPL', source: '' }],
  holdingsWithPrices: [
    {
      id: 'h1',
      symbol: 'AAPL',
      source: '',
      quantity: 10,
      averagePrice: 150,
      currentPrice: 165,
      currentValue: 1650,
      navPercent: 25,
      stockPerformancePercent: 10,
      currency: 'USD' as const
    }
  ],
  totalCash: 0,
  totalPortfolioValue: 6600,
  totalInvested: 5000,
  loading: false,
  baseCurrency: 'USD' as const,
  fetchHoldings: mockFetchHoldings,
  fetchTransactions: mockFetchTransactions,
  fetchAccount: mockFetchAccount,
  updateStockPrice: vi.fn(),
  updateHoldingCurrentPrice: vi.fn()
}

let portfolioStoreMock = defaultMockStore
vi.mock('@/stores/portfolio', () => ({
  usePortfolioStore: () => portfolioStoreMock
}))

vi.mock('@/utils/stockPrice', () => ({
  getMultipleStockPrices: vi.fn().mockResolvedValue([])
}))

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    portfolioStoreMock = defaultMockStore
  })

  it('shows My Holdings section', async () => {
    const { findByRole } = renderWithProviders(Dashboard)
    const heading = await findByRole('heading', { name: 'My Holdings' })
    expect(heading).toBeDefined()
  })

  it('displays CASH as a row in My Holdings when totalCash > 0 (#43)', async () => {
    const { findByText } = renderWithProviders(Dashboard)
    const cashCell = await findByText('CASH')
    expect(cashCell).toBeDefined()
  })

  it('displays stock performance column with + for gain and green color (#46)', async () => {
    portfolioStoreMock = mockStoreWithHoldings
    const { findByText } = renderWithProviders(Dashboard)
    // Performance column shows +10.00% for 10% gain
    const perfCell = await findByText('+10.00%')
    expect(perfCell).toBeDefined()
    expect(perfCell.className).toContain('text-green-600')
  })

  it('displays NAV% without + sign and in purple (#46)', async () => {
    portfolioStoreMock = mockStoreWithHoldings
    const { findByText } = renderWithProviders(Dashboard)
    // NAV% shows 25.00% (no + sign)
    const navCell = await findByText('25.00%')
    expect(navCell).toBeDefined()
    expect(navCell.className).toContain('text-purple-600')
  })
})
