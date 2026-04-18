<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Add Transaction Button -->
    <div class="flex justify-between items-center">
      <h2 class="text-lg sm:text-xl font-semibold text-gray-900">{{ $t('portfolioTracker.transactions') }}</h2>
      <button
        @click="showForm = true"
        class="bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 transition-colors text-sm sm:text-base touch-manipulation"
      >
        {{ $t('portfolioTracker.addTransaction') }}
      </button>
    </div>

    <!-- Transaction Form Modal -->
    <div
      v-if="showForm"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      @click.self="closeForm"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">{{ $t('portfolioTracker.addTransaction') }}</h3>
        
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <!-- Transaction Type -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              {{ $t('portfolioTracker.transactionType') }}
            </label>
            <div class="flex gap-4">
              <label class="flex items-center">
                <input
                  v-model="form.type"
                  type="radio"
                  value="buy"
                  class="mr-2"
                />
                <span class="text-sm text-gray-700">{{ $t('portfolioTracker.buy') }}</span>
              </label>
              <label class="flex items-center">
                <input
                  v-model="form.type"
                  type="radio"
                  value="sell"
                  class="mr-2"
                />
                <span class="text-sm text-gray-700">{{ $t('portfolioTracker.sell') }}</span>
              </label>
            </div>
          </div>

          <!-- Symbol -->
          <div>
            <label for="tx-symbol" class="block text-sm font-medium text-gray-700 mb-2">
              {{ $t('portfolioTracker.symbol') }} <span class="text-red-500">*</span>
            </label>
            <input
              id="tx-symbol"
              v-model="form.symbol"
              type="text"
              required
              placeholder="AAPL"
              @blur="updatePriceFromSymbol"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              :class="{ 'border-red-500': errors.symbol }"
            />
            <p v-if="errors.symbol" class="mt-1 text-sm text-red-600">{{ errors.symbol }}</p>
          </div>

          <!-- Quantity -->
          <div>
            <label for="tx-quantity" class="block text-sm font-medium text-gray-700 mb-2">
              {{ $t('portfolioTracker.quantity') }} <span class="text-red-500">*</span>
            </label>
            <input
              id="tx-quantity"
              v-model.number="form.quantity"
              type="number"
              required
              min="0.0001"
              step="0.0001"
              placeholder="10"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              :class="{ 'border-red-500': errors.quantity }"
            />
            <p v-if="errors.quantity" class="mt-1 text-sm text-red-600">{{ errors.quantity }}</p>
          </div>

          <!-- Price -->
          <div>
            <label for="tx-price" class="block text-sm font-medium text-gray-700 mb-2">
              {{ $t('portfolioTracker.pricePerShare') }} <span class="text-red-500">*</span>
            </label>
            <div class="flex gap-2">
              <input
                id="tx-price"
                v-model.number="form.price"
                type="number"
                required
                min="0.01"
                step="0.01"
                placeholder="150.00"
                class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                :class="{ 'border-red-500': errors.price }"
              />
              <select
                v-model="form.currency"
                class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 min-w-[80px]"
                :aria-label="$t('portfolioTracker.priceCurrency')"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <p v-if="errors.price" class="mt-1 text-sm text-red-600">{{ errors.price }}</p>
          </div>

          <!-- Date -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              {{ $t('portfolioTracker.date') }} <span class="text-red-500">*</span>
            </label>
            <input
              v-model="form.date"
              type="date"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <!-- Source / Broker: select existing or add new -->
          <div class="space-y-3">
            <label class="block text-sm font-medium text-gray-700">
              {{ $t('portfolioTracker.source') }}
            </label>
            <template v-if="portfolioStore.distinctSources.length > 0">
              <select
                v-model="form.sourceSelect"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900"
                :aria-label="$t('portfolioTracker.sourceSelectExisting')"
              >
                <option value="">
                  {{ $t('portfolioTracker.sourceAddNew') }}
                </option>
                <option
                  v-for="s in portfolioStore.distinctSources"
                  :key="s"
                  :value="s"
                >
                  {{ s }}
                </option>
              </select>
              <div v-if="form.sourceSelect === ''" class="pt-1">
                <label class="sr-only" for="source-new-input">{{ $t('portfolioTracker.sourceNewLabel') }}</label>
                <input
                  id="source-new-input"
                  v-model="form.sourceNew"
                  type="text"
                  :placeholder="$t('portfolioTracker.sourcePlaceholder')"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </template>
            <template v-else>
              <input
                v-model="form.sourceNew"
                type="text"
                :placeholder="$t('portfolioTracker.sourcePlaceholder')"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                :aria-label="$t('portfolioTracker.source')"
              />
            </template>
          </div>

          <!-- Error Message -->
          <div v-if="submitError" class="bg-red-50 border border-red-200 rounded-lg p-3">
            <p class="text-sm text-red-600">{{ submitError }}</p>
          </div>

          <!-- Form Actions -->
          <div class="flex gap-3 pt-4">
            <button
              type="button"
              @click="closeForm"
              class="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm sm:text-base"
            >
              {{ $t('common.cancel') }}
            </button>
            <button
              type="submit"
              :disabled="submitting"
              class="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              <span v-if="submitting">{{ $t('common.saving') }}</span>
              <span v-else>{{ $t('common.save') }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Transactions List -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <div v-if="portfolioStore.loading && portfolioStore.transactions.length === 0" class="p-8 text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p class="text-sm text-gray-600">{{ $t('common.loading') }}</p>
      </div>

      <div v-else-if="portfolioStore.transactions.length === 0" class="p-8 text-center">
        <p class="text-gray-600 mb-4">{{ $t('portfolioTracker.noTransactions') }}</p>
        <button
          @click="showForm = true"
          class="bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 transition-colors text-sm sm:text-base"
        >
          {{ $t('portfolioTracker.addFirstTransaction') }}
        </button>
      </div>

      <div v-else class="overflow-x-auto">
        <!-- Filter by source -->
        <div v-if="portfolioStore.distinctSources.length > 0" class="px-4 py-2 border-b border-gray-200 bg-gray-50 flex items-center gap-2 flex-wrap">
          <span class="text-sm font-medium text-gray-700">{{ $t('portfolioTracker.filterBySource') }}:</span>
          <select
            v-model="sourceFilter"
            :aria-label="$t('portfolioTracker.filterBySource')"
            class="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">{{ $t('portfolioTracker.allSources') }}</option>
            <option v-for="s in portfolioStore.distinctSources" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('portfolioTracker.date') }}</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('portfolioTracker.type') }}</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('portfolioTracker.symbol') }}</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('portfolioTracker.source') }}</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('portfolioTracker.quantity') }}</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('portfolioTracker.price') }}</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('portfolioTracker.priceCurrency') }}</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('portfolioTracker.total') }}</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr
              v-for="transaction in filteredTransactions"
              :key="transaction.id"
              class="hover:bg-gray-50"
            >
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="text-sm text-gray-900">{{ formatDate(transaction.date) }}</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span
                  class="px-2 py-1 text-xs font-medium rounded-full"
                  :class="transaction.type === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                >
                  {{ transaction.type === 'buy' ? $t('portfolioTracker.buy') : $t('portfolioTracker.sell') }}
                </span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="text-sm font-semibold text-gray-900">{{ transaction.symbol }}</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="text-sm text-gray-600">{{ (transaction.source || '').trim() || '—' }}</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="text-sm text-gray-900">{{ transaction.quantity }}</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="text-sm text-gray-900">{{ formatCurrency(transaction.price, transaction.currency) }}</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="text-sm text-gray-600">{{ transaction.currency ?? 'USD' }}</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="text-sm font-medium text-gray-900">{{ formatCurrency(transaction.quantity * transaction.price, transaction.currency) }}</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <button
                  @click="handleDelete(transaction.id!)"
                  :disabled="deleting"
                  class="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                >
                  {{ $t('common.delete') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePortfolioStore } from '@/stores/portfolio'
import { useI18n } from 'vue-i18n'
import type { Timestamp } from 'firebase/firestore'
import type { Transaction } from '@/firebase/firestore'

const portfolioStore = usePortfolioStore()
const { t } = useI18n()

const showForm = ref(false)
const submitting = ref(false)
const deleting = ref(false)
const submitError = ref('')
const sourceFilter = ref('')

const form = ref({
  type: 'buy' as 'buy' | 'sell',
  symbol: '',
  quantity: 0,
  price: 0,
  currency: 'USD' as 'EUR' | 'USD',
  date: new Date().toISOString().split('T')[0],
  sourceSelect: '' as string,
  sourceNew: ''
})

const filteredTransactions = computed<Transaction[]>(() => {
  const list = portfolioStore.transactions
  if (!sourceFilter.value) return list
  return list.filter(tx => (tx.source ?? '').trim() === sourceFilter.value)
})

const errors = ref({
  symbol: '',
  quantity: '',
  price: ''
})

onMounted(async () => {
  await portfolioStore.fetchHoldings()
  await portfolioStore.fetchTransactions()
  // Load prices for existing holdings
  const symbols = portfolioStore.holdings.map(h => h.symbol)
  if (symbols.length > 0) {
    const { getMultipleStockPrices } = await import('@/utils/stockPrice')
    const prices = await getMultipleStockPrices(symbols)
    for (const [symbol, price] of prices) {
      await portfolioStore.updateStockPrice(symbol, price)
    }
  }
})

const updatePriceFromSymbol = () => {
  if (form.value.symbol) {
    const symbol = form.value.symbol.toUpperCase()
    const currentPrice = portfolioStore.getStockPrice(symbol)
    if (currentPrice !== null && currentPrice > 0) {
      form.value.price = currentPrice
    }
  }
}

const closeForm = () => {
  showForm.value = false
  form.value = {
    type: 'buy',
    symbol: '',
    quantity: 0,
    price: 0,
    currency: 'USD',
    date: new Date().toISOString().split('T')[0],
    sourceSelect: '',
    sourceNew: ''
  }
  errors.value = { symbol: '', quantity: '', price: '' }
  submitError.value = ''
}

const validateForm = (): boolean => {
  errors.value = { symbol: '', quantity: '', price: '' }
  
  if (!form.value.symbol.trim()) {
    errors.value.symbol = t('portfolioTracker.symbolRequired')
    return false
  }

  if (form.value.quantity <= 0) {
    errors.value.quantity = t('portfolioTracker.quantityRequired')
    return false
  }

  if (form.value.price <= 0) {
    errors.value.price = t('portfolioTracker.priceRequired')
    return false
  }

  return true
}

const handleSubmit = async () => {
  if (!validateForm()) return

  submitting.value = true
  submitError.value = ''

  try {
    const date = new Date(form.value.date)
    const timestamp: Timestamp = {
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0
    } as Timestamp

    const effectiveSource = (form.value.sourceSelect || form.value.sourceNew.trim()).trim()
    await portfolioStore.createTransaction({
      type: form.value.type,
      symbol: form.value.symbol.toUpperCase(),
      quantity: form.value.quantity,
      price: form.value.price,
      currency: form.value.currency,
      date: timestamp,
      ...(effectiveSource ? { source: effectiveSource } : {})
    })

    closeForm()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('portfolioTracker.transactionError')
    submitError.value = errorMessage
    console.error('Error creating transaction:', error)
  } finally {
    submitting.value = false
  }
}

const handleDelete = async (transactionId: string) => {
  if (!confirm(t('portfolioTracker.deleteConfirm'))) return

  deleting.value = true
  try {
    await portfolioStore.removeTransaction(transactionId)
  } catch (error) {
    console.error('Error deleting transaction:', error)
    alert(t('portfolioTracker.deleteError'))
  } finally {
    deleting.value = false
  }
}

const formatDate = (timestamp: Timestamp | { seconds: number; nanoseconds?: number }): string => {
  const date = timestamp && 'seconds' in timestamp 
    ? new Date(timestamp.seconds * 1000)
    : new Date()
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date)
}

const formatCurrency = (value: number, currency: 'EUR' | 'USD' = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}
</script>
