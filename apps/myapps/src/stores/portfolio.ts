import { defineStore } from 'pinia'
import { ref, computed, type Ref } from 'vue'
import { 
  getStockHoldings as getHoldingsFirebase, 
  addStockHolding as addHoldingFirebase, 
  updateStockHolding as updateHoldingFirebase, 
  deleteStockHolding as deleteHoldingFirebase,
  getTransactions as getTransactionsFirebase,
  addTransaction as addTransactionFirebase,
  deleteTransaction as deleteTransactionFirebase,
  getPortfolioAccount as getAccountFirebase,
  setPortfolioAccount as setAccountFirebase,
  updatePortfolioAccount as updateAccountFirebase,
  type StockHolding,
  type Transaction,
  type PortfolioAccount
} from '@/firebase/firestore'
import { 
  getStockHoldings as getHoldingsLocal, 
  addStockHolding as addHoldingLocal, 
  updateStockHolding as updateHoldingLocal, 
  deleteStockHolding as deleteHoldingLocal,
  getTransactions as getTransactionsLocal,
  addTransaction as addTransactionLocal,
  deleteTransaction as deleteTransactionLocal,
  getPortfolioAccount as getAccountLocal,
  updatePortfolioAccount as updateAccountLocal
} from '@/storage/localStorage'
import { useAuthStore } from './auth'
import type { DocumentReference, DocumentData } from 'firebase/firestore'
import type { Currency } from '@/firebase/firestore'

export interface StockPrice {
  symbol: string
  price: number
  lastUpdated: Date
}

export const usePortfolioStore = defineStore('portfolio', () => {
  const holdings: Ref<StockHolding[]> = ref([])
  const transactions: Ref<Transaction[]> = ref([])
  const stockPrices: Ref<Map<string, StockPrice>> = ref(new Map())
  const account: Ref<PortfolioAccount | null> = ref(null)
  const loading: Ref<boolean> = ref(false)
  const error: Ref<string | null> = ref(null)

  // Base currency for display (default USD)
  const baseCurrency = computed<Currency>(() => account.value?.baseCurrency ?? 'USD')

  // Exchange rates: 1 EUR = eurToUsd USD, 1 USD = usdToEur EUR
  const eurToUsd = computed<number>(() => account.value?.eurToUsd ?? 1.0)
  const usdToEur = computed<number>(() => account.value?.usdToEur ?? 1.0)

  // Convert amount to base currency
  const toBaseCurrency = (amount: number, fromCurrency: Currency): number => {
    if (baseCurrency.value === fromCurrency) return amount
    if (fromCurrency === 'EUR') return amount * eurToUsd.value
    return amount * usdToEur.value // USD -> EUR
  }

  // Computed: Total cash available (always in base currency)
  const totalCash = computed<number>(() => account.value?.cash ?? 0)

  // Computed: Total invested money (deposits, always in base currency)
  const totalInvested = computed<number>(() => account.value?.totalInvested ?? 0)

  // Last buy price for a symbol in given currency (from most recent matching buy)
  const lastBuyPriceForSymbol = (symbol: string, currency: Currency): number | null => {
    const sym = symbol.toUpperCase()
    const buys = transactions.value.filter(
      t =>
        t.type === 'buy' &&
        t.symbol.toUpperCase() === sym &&
        (t.currency ?? 'USD') === currency
    )
    if (buys.length === 0) return null
    const sorted = [...buys].sort((a, b) => {
      const ta = a.date && 'seconds' in a.date ? a.date.seconds : 0
      const tb = b.date && 'seconds' in b.date ? b.date.seconds : 0
      return tb - ta
    })
    return sorted[0].price
  }

  // Get current price in holding's currency. API prices are USD; convert if holding is EUR.
  const getCurrentPriceInHoldingCurrency = (holding: StockHolding): number => {
    const sym = holding.symbol.toUpperCase()
    const holdingCurrency = holding.currency ?? 'USD'
    const priceData = stockPrices.value.get(sym)
    if (holdingCurrency === 'USD') {
      return (
        holding.currentPrice ??
        priceData?.price ??
        lastBuyPriceForSymbol(holding.symbol, 'USD') ??
        holding.averagePrice ??
        0
      )
    }
    return (
      holding.currentPrice ??
      (priceData?.price != null ? priceData.price * usdToEur.value : null) ??
      lastBuyPriceForSymbol(holding.symbol, 'EUR') ??
      holding.averagePrice ??
      0
    )
  }

  // Computed: Get holdings with current prices (values in base currency for totals)
  const holdingsWithPrices = computed(() => {
    return holdings.value.map(holding => {
      const holdingCurrency = holding.currency ?? 'USD'
      const currentPriceInHoldingCurrency = getCurrentPriceInHoldingCurrency(holding)
      const currentValueInHoldingCurrency = currentPriceInHoldingCurrency * holding.quantity
      const costBasisInHoldingCurrency = holding.averagePrice * holding.quantity
      const currentValueBase = toBaseCurrency(currentValueInHoldingCurrency, holdingCurrency)
      const costBasisBase = toBaseCurrency(costBasisInHoldingCurrency, holdingCurrency)
      const nav = currentValueBase - costBasisBase

      return {
        ...holding,
        currentPrice: currentPriceInHoldingCurrency,
        currentValue: currentValueBase,
        costBasis: costBasisBase,
        nav,
        navPercent: 0
      }
    })
  })

  // Computed: Total stock value (sum of all holdings' current value)
  const totalStockValue = computed<number>(() => {
    return holdingsWithPrices.value.reduce((sum: number, holding) => sum + holding.currentValue, 0)
  })

  // Computed: Total portfolio value = cash + stock value
  const totalPortfolioValue = computed<number>(() => {
    return totalCash.value + totalStockValue.value
  })

  // Computed: Holdings with NAV% and stock performance calculated (needs portfolio value)
  const holdingsWithNAVPercent = computed(() => {
    const portfolioValue = totalPortfolioValue.value
    return holdingsWithPrices.value.map(holding => {
      // Stock performance % = (currentPrice - averagePrice) / averagePrice * 100
      const stockPerformancePercent =
        holding.averagePrice > 0
          ? ((holding.currentPrice - holding.averagePrice) / holding.averagePrice) * 100
          : null
      return {
        ...holding,
        // NAV% = (stock value / total portfolio value) * 100 (allocation)
        navPercent: portfolioValue > 0 ? (holding.currentValue / portfolioValue) * 100 : 0,
        stockPerformancePercent
      }
    })
  })

  // Computed: Total cost basis
  const totalCostBasis = computed<number>(() => {
    return holdings.value.reduce((sum: number, holding) => sum + (holding.averagePrice * holding.quantity), 0)
  })

  // Computed: Total NAV (stock value - cost basis)
  const totalNAV = computed<number>(() => {
    return totalStockValue.value - totalCostBasis.value
  })

  // Computed: NAV percentage = (stock value / total portfolio value) * 100
  const totalNAVPercent = computed<number>(() => {
    return totalPortfolioValue.value > 0 ? (totalStockValue.value / totalPortfolioValue.value) * 100 : 0
  })

  // Distinct broker/source names from transactions (for filter dropdown)
  const distinctSources = computed<string[]>(() => {
    const set = new Set(
      transactions.value.map(t => (t.source ?? '').trim()).filter(Boolean)
    )
    return [...set].sort()
  })

  const fetchHoldings = async (): Promise<void> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return

    loading.value = true
    error.value = null
    try {
      if (authStore.localMode) {
        holdings.value = await getHoldingsLocal()
      } else if (authStore.user) {
        holdings.value = await getHoldingsFirebase(authStore.user.uid)
      }
      // Seed in-memory stockPrices from persisted currentPrice so UI shows it
      holdings.value.forEach(h => {
        if (h.currentPrice != null && h.currentPrice > 0) {
          const sym = h.symbol.toUpperCase()
          stockPrices.value.set(sym, {
            symbol: sym,
            price: h.currentPrice,
            lastUpdated: new Date()
          })
        }
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load holdings'
      error.value = errorMessage
      console.error('Error fetching holdings:', err)
    } finally {
      loading.value = false
    }
  }

  const fetchTransactions = async (): Promise<void> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return

    loading.value = true
    error.value = null
    try {
      if (authStore.localMode) {
        transactions.value = await getTransactionsLocal()
      } else if (authStore.user) {
        transactions.value = await getTransactionsFirebase(authStore.user.uid)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load transactions'
      error.value = errorMessage
      console.error('Error fetching transactions:', err)
    } finally {
      loading.value = false
    }
  }

  const createTransaction = async (transactionData: Omit<Transaction, 'id' | 'createdAt'>): Promise<DocumentReference<DocumentData> | { id: string }> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) throw new Error('User not authenticated')

    error.value = null
    try {
      let docRef: DocumentReference<DocumentData> | { id: string }
      if (authStore.localMode) {
        docRef = await addTransactionLocal(transactionData)
      } else if (authStore.user) {
        docRef = await addTransactionFirebase(authStore.user.uid, transactionData)
      } else {
        throw new Error('User not authenticated')
      }

      // Update holdings based on transaction
      await processTransaction(transactionData)
      
      await fetchTransactions()
      await fetchHoldings()
      return docRef
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create transaction'
      error.value = errorMessage
      console.error('Error creating transaction:', err)
      throw err
    }
  }

  const sourceOf = (t: Transaction | Omit<Transaction, 'id' | 'createdAt'>) => (t.source ?? '').trim()
  const currencyOf = (t: Transaction | Omit<Transaction, 'id' | 'createdAt'>): Currency =>
    t.currency ?? 'USD'

  const processTransaction = async (transactionData: Omit<Transaction, 'id' | 'createdAt'>): Promise<void> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) throw new Error('User not authenticated')

    const symbol = transactionData.symbol.toUpperCase()
    const source = sourceOf(transactionData)
    const currency = currencyOf(transactionData)
    const existingHolding = holdings.value.find(
      h =>
        h.symbol.toUpperCase() === symbol &&
        (h.source ?? '').trim() === source &&
        (h.currency ?? 'USD') === currency
    )

    if (transactionData.type === 'buy') {
      if (existingHolding) {
        // Update existing holding: recalculate average price (same currency)
        const totalQuantity = existingHolding.quantity + transactionData.quantity
        const totalCost =
          existingHolding.averagePrice * existingHolding.quantity +
          transactionData.price * transactionData.quantity
        const newAveragePrice = totalCost / totalQuantity

        if (authStore.localMode) {
          await updateHoldingLocal(existingHolding.id!, {
            quantity: totalQuantity,
            averagePrice: newAveragePrice
          })
        } else if (authStore.user) {
          await updateHoldingFirebase(authStore.user.uid, existingHolding.id!, {
            quantity: totalQuantity,
            averagePrice: newAveragePrice
          })
        }
      } else {
        // Create new holding; default current price to buy price (manual tracking per #40)
        const newHolding: Omit<StockHolding, 'id' | 'createdAt' | 'updatedAt'> = {
          symbol,
          quantity: transactionData.quantity,
          averagePrice: transactionData.price,
          currentPrice: transactionData.price,
          currency,
          ...(source ? { source } : {})
        }

        if (authStore.localMode) {
          await addHoldingLocal(newHolding)
        } else if (authStore.user) {
          await addHoldingFirebase(authStore.user.uid, newHolding)
        }
      }
    } else if (transactionData.type === 'sell') {
      if (!existingHolding) {
        throw new Error(`Cannot sell ${symbol}: No holdings found${source ? ` for source "${source}"` : ''}`)
      }
      if (existingHolding.quantity < transactionData.quantity) {
        throw new Error(`Cannot sell ${transactionData.quantity} shares: Only ${existingHolding.quantity} shares owned`)
      }

      const newQuantity = existingHolding.quantity - transactionData.quantity
      if (newQuantity === 0) {
        // Delete holding if quantity reaches zero
        if (authStore.localMode) {
          await deleteHoldingLocal(existingHolding.id!)
        } else if (authStore.user) {
          await deleteHoldingFirebase(authStore.user.uid, existingHolding.id!)
        }
      } else {
        // Update quantity (average price stays the same)
        if (authStore.localMode) {
          await updateHoldingLocal(existingHolding.id!, { quantity: newQuantity })
        } else if (authStore.user) {
          await updateHoldingFirebase(authStore.user.uid, existingHolding.id!, { quantity: newQuantity })
        }
      }
    }
  }

  const removeTransaction = async (transactionId: string): Promise<void> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) throw new Error('User not authenticated')

    error.value = null
    try {
      // Find transaction to reverse
      const transaction = transactions.value.find(t => t.id === transactionId)
      if (!transaction) {
        throw new Error('Transaction not found')
      }

      // Delete transaction
      if (authStore.localMode) {
        await deleteTransactionLocal(transactionId)
      } else if (authStore.user) {
        await deleteTransactionFirebase(authStore.user.uid, transactionId)
      }

      // Rebuild holdings from remaining transactions (excluding the deleted one)
      await rebuildHoldingsFromTransactions(transactionId)

      await fetchTransactions()
      await fetchHoldings()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete transaction'
      error.value = errorMessage
      console.error('Error deleting transaction:', err)
      throw err
    }
  }

  const rebuildHoldingsFromTransactions = async (excludeTransactionId?: string): Promise<void> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return

    // Get all transactions except the excluded one
    const remainingTransactions = transactions.value.filter(t => t.id && t.id !== excludeTransactionId)

    // Clear all holdings
    for (const holding of holdings.value) {
      if (authStore.localMode) {
        await deleteHoldingLocal(holding.id!)
      } else if (authStore.user) {
        await deleteHoldingFirebase(authStore.user.uid, holding.id!)
      }
    }

    // Rebuild holdings from transactions, keyed by (symbol, source, currency)
    const holdingsMap = new Map<string, { quantity: number; totalCost: number; currency: Currency }>()
    for (const transaction of remainingTransactions) {
      const symbol = transaction.symbol.toUpperCase()
      const source = sourceOf(transaction)
      const currency = currencyOf(transaction)
      const key = `${symbol}|${source}|${currency}`
      const existing = holdingsMap.get(key) || { quantity: 0, totalCost: 0, currency }
      existing.currency = currency

      if (transaction.type === 'buy') {
        existing.quantity += transaction.quantity
        existing.totalCost += transaction.price * transaction.quantity
      } else {
        existing.quantity -= transaction.quantity
        const avgPrice = existing.totalCost / (existing.quantity + transaction.quantity)
        existing.totalCost -= avgPrice * transaction.quantity
      }

      if (existing.quantity > 0) {
        holdingsMap.set(key, existing)
      } else {
        holdingsMap.delete(key)
      }
    }

    // Create holdings from map
    for (const [key, data] of holdingsMap.entries()) {
      const parts = key.split('|')
      const symbol = parts[0] ?? ''
      const source = parts[1] ?? ''
      const currency = (parts[2] as Currency) ?? 'USD'
      const newHolding: Omit<StockHolding, 'id' | 'createdAt' | 'updatedAt'> = {
        symbol,
        quantity: data.quantity,
        averagePrice: data.totalCost / data.quantity,
        currency,
        ...(source ? { source } : {})
      }
      if (authStore.localMode) {
        await addHoldingLocal(newHolding)
      } else if (authStore.user) {
        await addHoldingFirebase(authStore.user.uid, newHolding)
      }
    }
  }

  const updateStockPrice = async (symbol: string, price: number): Promise<void> => {
    const authStore = useAuthStore()
    const upperSymbol = symbol.toUpperCase()
    stockPrices.value.set(upperSymbol, {
      symbol: upperSymbol,
      price,
      lastUpdated: new Date()
    })
    // Persist manual current price only to USD holdings (API returns USD). EUR holdings use conversion at read time.
    const matchingHoldings = holdings.value.filter(
      h => h.symbol.toUpperCase() === upperSymbol && (h.currency ?? 'USD') === 'USD'
    )
    for (const holding of matchingHoldings) {
      if (!holding.id) continue
      try {
        if (authStore.localMode) {
          await updateHoldingLocal(holding.id, { currentPrice: price })
        } else if (authStore.user) {
          await updateHoldingFirebase(authStore.user.uid, holding.id, { currentPrice: price })
        }
        const idx = holdings.value.findIndex(h => h.id === holding.id)
        if (idx !== -1) {
          holdings.value = [
            ...holdings.value.slice(0, idx),
            { ...holdings.value[idx], currentPrice: price },
            ...holdings.value.slice(idx + 1)
          ]
        }
      } catch (err) {
        console.error('Error persisting current price:', err)
      }
    }
  }

  const getStockPrice = (symbol: string): number | null => {
    const priceData = stockPrices.value.get(symbol.toUpperCase())
    return priceData?.price || null
  }

  const updateHoldingCurrentPrice = async (holdingId: string, price: number): Promise<void> => {
    const authStore = useAuthStore()
    const holding = holdings.value.find(h => h.id === holdingId)
    if (!holding?.id) return
    try {
      if (authStore.localMode) {
        await updateHoldingLocal(holdingId, { currentPrice: price })
      } else if (authStore.user) {
        await updateHoldingFirebase(authStore.user.uid, holdingId, { currentPrice: price })
      }
      const idx = holdings.value.findIndex(h => h.id === holdingId)
      if (idx !== -1) {
        holdings.value = [
          ...holdings.value.slice(0, idx),
          { ...holdings.value[idx], currentPrice: price },
          ...holdings.value.slice(idx + 1)
        ]
      }
    } catch (err) {
      console.error('Error updating holding price:', err)
    }
  }

  const fetchAccount = async (): Promise<void> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return

    loading.value = true
    error.value = null
    try {
      if (authStore.localMode) {
        account.value = await getAccountLocal()
      } else if (authStore.user) {
        account.value = await getAccountFirebase(authStore.user.uid)
      }
      
      // Initialize with defaults if account doesn't exist
      if (!account.value) {
        account.value = {
          totalInvested: 0,
          cash: 0
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load account'
      error.value = errorMessage
      console.error('Error fetching account:', err)
    } finally {
      loading.value = false
    }
  }

  const updateAccount = async (updates: Partial<PortfolioAccount>): Promise<void> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) throw new Error('User not authenticated')

    error.value = null
    try {
      const updatedAccount = {
        ...(account.value || { totalInvested: 0, cash: 0 }),
        ...updates
      }

      if (authStore.localMode) {
        await updateAccountLocal(updatedAccount)
      } else if (authStore.user) {
        // Check if account exists
        const existing = await getAccountFirebase(authStore.user.uid)
        if (existing) {
          await updateAccountFirebase(authStore.user.uid, updatedAccount)
        } else {
          await setAccountFirebase(authStore.user.uid, updatedAccount)
        }
      } else {
        throw new Error('User not authenticated')
      }

      await fetchAccount()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update account'
      error.value = errorMessage
      console.error('Error updating account:', err)
      throw err
    }
  }

  return {
    holdings,
    transactions,
    stockPrices,
    account,
    loading,
    error,
    baseCurrency,
    eurToUsd,
    usdToEur,
    holdingsWithPrices: holdingsWithNAVPercent,
    totalStockValue,
    totalCash,
    totalInvested,
    totalPortfolioValue,
    totalCostBasis,
    totalNAV,
    totalNAVPercent,
    distinctSources,
    fetchHoldings,
    fetchTransactions,
    fetchAccount,
    createTransaction,
    removeTransaction,
    updateStockPrice,
    updateHoldingCurrentPrice,
    getStockPrice,
    updateAccount
  }
})
