<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Overview Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
      <!-- Total Invested -->
      <div class="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
        <div class="flex items-center justify-between mb-1 sm:mb-2">
          <h3 class="text-xs sm:text-sm font-medium text-gray-600">{{ $t('portfolioTracker.totalInvested') }}</h3>
          <span class="text-xl sm:text-2xl">💵</span>
        </div>
        <p class="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{{ formatCurrency(portfolioStore.totalInvested) }}</p>
        <p class="text-xs text-gray-500 mt-1">{{ $t('portfolioTracker.deposits') }}</p>
      </div>

      <!-- Total Cash -->
      <div class="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
        <div class="flex items-center justify-between mb-1 sm:mb-2">
          <h3 class="text-xs sm:text-sm font-medium text-gray-600">{{ $t('portfolioTracker.totalCash') }}</h3>
          <span class="text-xl sm:text-2xl">💳</span>
        </div>
        <p class="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{{ formatCurrency(portfolioStore.totalCash) }}</p>
        <p class="text-xs text-gray-500 mt-1">{{ $t('portfolioTracker.available') }}</p>
      </div>

      <!-- Total Stock Value -->
      <div class="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
        <div class="flex items-center justify-between mb-1 sm:mb-2">
          <h3 class="text-xs sm:text-sm font-medium text-gray-600">{{ $t('portfolioTracker.totalStockValue') }}</h3>
          <span class="text-primary-500">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><rect x="3" y="13" width="4" height="8" rx="1"/><rect x="10" y="9" width="4" height="12" rx="1"/><rect x="17" y="5" width="4" height="16" rx="1"/></svg>
          </span>
        </div>
        <p class="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{{ formatCurrency(portfolioStore.totalStockValue) }}</p>
        <p class="text-xs text-gray-500 mt-1">{{ portfolioStore.holdings.length }} {{ $t('portfolioTracker.holdings') }}</p>
      </div>

      <!-- Total Portfolio Value -->
      <div class="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
        <div class="flex items-center justify-between mb-1 sm:mb-2">
          <h3 class="text-xs sm:text-sm font-medium text-gray-600">{{ $t('portfolioTracker.totalPortfolioValue') }}</h3>
          <span class="text-primary-500">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><circle cx="12" cy="12" r="9"/><path d="M14.5 9.5a2.5 2.5 0 0 0-5 0c0 1.5 1 2 2.5 2.5S14.5 13 14.5 14.5a2.5 2.5 0 0 1-5 0"/><line x1="12" y1="7" x2="12" y2="9"/><line x1="12" y1="15" x2="12" y2="17"/></svg>
          </span>
        </div>
        <p class="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{{ formatCurrency(portfolioStore.totalPortfolioValue) }}</p>
        <p class="text-xs text-gray-500 mt-1">{{ $t('portfolioTracker.cashPlusStocks') }}</p>
      </div>
    </div>

    <!-- Additional Metrics -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
      <!-- Performance -->
      <div class="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
        <div class="flex items-center justify-between mb-1 sm:mb-2">
          <h3 class="text-xs sm:text-sm font-medium text-gray-600">{{ $t('portfolioTracker.performance') }}</h3>
          <span class="text-primary-500">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><polyline points="3 17 8 11 12 14 18 7 21 10"/><line x1="3" y1="21" x2="21" y2="21"/></svg>
          </span>
        </div>
        <p 
          class="text-xl sm:text-2xl lg:text-3xl font-bold"
          :class="performance >= 0 ? 'text-green-600' : 'text-red-600'"
        >
          {{ formatPercent(performance) }}
        </p>
        <p class="text-xs text-gray-500 mt-1">{{ $t('portfolioTracker.performanceDesc') }}</p>
      </div>

      <!-- Refresh Button -->
      <div class="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6 flex items-center justify-center">
        <button
          @click="refreshPrices"
          :disabled="refreshing"
          class="w-full bg-primary-600 text-white py-2.5 sm:py-3 px-4 rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base touch-manipulation"
        >
          <span v-if="refreshing">{{ $t('portfolioTracker.refreshing') }}</span>
          <span v-else>{{ $t('portfolioTracker.refreshPrices') }}</span>
        </button>
      </div>
    </div>

    <!-- Holdings Table -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <div class="p-4 sm:p-6 border-b border-gray-200">
        <div class="flex justify-between items-center mb-2 flex-wrap gap-2">
          <h2 class="text-lg sm:text-xl font-semibold text-gray-900">{{ $t('portfolioTracker.myHoldings') }}</h2>
          <div class="flex items-center gap-4 flex-wrap">
            <div v-if="distinctHoldingSources.length > 0" class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-700">{{ $t('portfolioTracker.filterBySource') }}:</span>
              <select
                v-model="sourceFilter"
                class="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">{{ $t('portfolioTracker.allSources') }}</option>
                <option v-for="s in distinctHoldingSources" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div v-if="portfolioStore.loading && portfolioStore.holdings.length === 0" class="p-8 text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p class="text-sm text-gray-600">{{ $t('common.loading') }}</p>
      </div>

      <div v-else-if="portfolioStore.holdings.length === 0 && portfolioStore.totalCash === 0" class="p-8 text-center">
        <p class="text-gray-600 mb-4">{{ $t('portfolioTracker.noHoldings') }}</p>
        <router-link
          to="/portfolio-tracker/transactions"
          class="inline-block bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 transition-colors text-sm sm:text-base"
        >
          {{ $t('portfolioTracker.addFirstTransaction') }}
        </router-link>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('portfolioTracker.symbol') }}</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('portfolioTracker.priceCurrency') }}</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('portfolioTracker.source') }}</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('portfolioTracker.quantity') }}</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('portfolioTracker.averagePrice') }}</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('portfolioTracker.currentPrice') }}</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('portfolioTracker.currentValue') }}</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('portfolioTracker.stockPerformance') }}</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('portfolioTracker.navPercent') }}</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr
              v-for="holding in filteredHoldings"
              :key="holding.id"
              class="hover:bg-gray-50"
            >
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="text-sm font-semibold text-gray-900">{{ holding.symbol }}</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="text-sm text-gray-600">{{ holding.id === 'cash' ? '—' : getHoldingCurrency(holding) }}</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="text-sm text-gray-600">{{ (holding.source || '').trim() || '—' }}</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="text-sm text-gray-900">{{ holding.id === 'cash' ? '—' : holding.quantity }}</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="text-sm text-gray-900">{{ holding.id === 'cash' ? '—' : formatCurrency(holding.averagePrice, getHoldingCurrency(holding)) }}</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <template v-if="holding.id === 'cash'">
                  <span class="text-sm text-gray-500">—</span>
                </template>
                <template v-else>
                  <div v-if="editingPrice === holding.id" class="flex items-center gap-2">
                    <input
                      v-model.number="editPriceValue"
                      type="number"
                      step="0.01"
                      min="0"
                      class="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      @keyup.enter="savePrice(holding)"
                      @keyup.esc="cancelEditPrice"
                    />
                    <button
                      @click="savePrice(holding)"
                      class="text-green-600 hover:text-green-800 text-sm font-medium"
                    >
                      ✓
                    </button>
                    <button
                      @click="cancelEditPrice"
                      class="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      ✕
                    </button>
                  </div>
                  <div v-else class="flex items-center gap-2">
                    <span v-if="holding.currentPrice > 0" class="text-sm text-gray-900">{{ formatCurrency(holding.currentPrice, getHoldingCurrency(holding)) }}</span>
                    <span v-else class="text-sm text-gray-400">{{ $t('portfolioTracker.loading') }}</span>
                    <button
                      @click="startEditPrice(holding.id!, holding.currentPrice)"
                      class="text-primary-600 hover:text-primary-800 text-xs"
                      :title="$t('portfolioTracker.editPrice')"
                    >
                      ✏️
                    </button>
                  </div>
                </template>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span v-if="holding.id === 'cash' || holding.currentPrice > 0" class="text-sm text-gray-900">{{ formatCurrency(holding.currentValue) }}</span>
                <span v-else class="text-sm text-gray-400">-</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span
                  v-if="holding.id === 'cash'"
                  class="text-sm text-gray-500"
                >—</span>
                <span
                  v-else-if="holding.stockPerformancePercent != null"
                  class="text-sm font-medium"
                  :class="holding.stockPerformancePercent >= 0 ? 'text-green-600' : 'text-red-600'"
                >
                  {{ formatStockPerformance(holding.stockPerformancePercent) }}
                </span>
                <span v-else class="text-sm text-gray-400">-</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span
                  v-if="holding.id === 'cash' || holding.currentPrice > 0"
                  class="text-sm font-medium text-purple-600"
                >
                  {{ formatNavPercent(holding.navPercent) }}
                </span>
                <span v-else class="text-sm text-gray-400">-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { usePortfolioStore } from '@/stores/portfolio'
import { getMultipleStockPrices } from '@/utils/stockPrice'
import { useI18n } from 'vue-i18n'

const portfolioStore = usePortfolioStore()
useI18n()
const refreshing = ref(false)
const editingPrice = ref<string | null>(null)
const editPriceValue = ref<number>(0)
const sourceFilter = ref('')

const distinctHoldingSources = computed(() => {
  const set = new Set(
    portfolioStore.holdings.map(h => (h.source ?? '').trim()).filter(Boolean)
  )
  return [...set].sort()
})

// Holdings list for My Holdings table; includes a CASH row when totalCash > 0 (issue #43)
const filteredHoldings = computed(() => {
  const list = portfolioStore.holdingsWithPrices
  const filtered = sourceFilter.value
    ? list.filter(h => (h.source ?? '').trim() === sourceFilter.value)
    : list
  const cash = portfolioStore.totalCash
  const total = portfolioStore.totalPortfolioValue
  if (cash <= 0) return filtered
  const cashRow = {
    id: 'cash' as const,
    symbol: 'CASH',
    source: '',
    quantity: 0,
    averagePrice: 0,
    currentPrice: 0,
    currentValue: cash,
    navPercent: total > 0 ? (cash / total) * 100 : 0,
    stockPerformancePercent: null as number | null,
    currency: undefined as 'EUR' | 'USD' | undefined
  }
  return [cashRow, ...filtered]
})

onMounted(async () => {
  await portfolioStore.fetchHoldings()
  await portfolioStore.fetchTransactions()
  await portfolioStore.fetchAccount()
  await refreshPrices()
})

const startEditPrice = (holdingId: string, currentPrice: number) => {
  editingPrice.value = holdingId
  editPriceValue.value = currentPrice > 0 ? currentPrice : 0
}

const cancelEditPrice = () => {
  editingPrice.value = null
  editPriceValue.value = 0
}

const savePrice = async (holding: { id?: string; symbol: string }) => {
  if (editPriceValue.value > 0 && holding.id) {
    await portfolioStore.updateHoldingCurrentPrice(holding.id, editPriceValue.value)
  }
  cancelEditPrice()
}

const refreshPrices = async () => {
  if (refreshing.value) return
  
  refreshing.value = true
  try {
    const symbols = portfolioStore.holdings.map(h => h.symbol)
    if (symbols.length === 0) return

    const prices = await getMultipleStockPrices(symbols)
    for (const [sym, price] of prices) {
      await portfolioStore.updateStockPrice(sym, price)
    }
  } catch (error) {
    console.error('Error refreshing prices:', error)
  } finally {
    refreshing.value = false
  }
}

const formatCurrency = (value: number, currency?: 'EUR' | 'USD'): string => {
  const curr = currency ?? portfolioStore.baseCurrency ?? 'USD'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: curr,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

const formatPercent = (value: number): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

// Stock performance: +X.XX% (green) or -X.XX% (red)
const getHoldingCurrency = (holding: { id?: string; currency?: 'EUR' | 'USD' }): 'EUR' | 'USD' =>
  holding.id === 'cash' ? portfolioStore.baseCurrency : (holding.currency ?? 'USD')

const formatStockPerformance = (value: number): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

// NAV%: X.XX% only, no + sign (allocation percentage)
const formatNavPercent = (value: number): string => {
  return `${value.toFixed(2)}%`
}

// Performance = (total portfolio value / total invested) - 1 (in percentage)
const performance = computed(() => {
  if (portfolioStore.totalInvested <= 0) return 0
  return ((portfolioStore.totalPortfolioValue / portfolioStore.totalInvested) - 1) * 100
})
</script>
