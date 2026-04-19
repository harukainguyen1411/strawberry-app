<template>
  <div class="space-y-4 sm:space-y-6">
    <div class="bg-white rounded-lg shadow p-4 sm:p-6">
      <h2 class="text-lg sm:text-xl font-semibold text-gray-900 mb-4">{{ $t('portfolioTracker.settings') }}</h2>
      
      <form @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Exchange Rates -->
        <div class="border-b border-gray-200 pb-6">
          <h3 class="text-sm font-medium text-gray-900 mb-3">{{ $t('portfolioTracker.exchangeRates') }}</h3>
          <div>
            <label for="eur-to-usd" class="block text-sm font-medium text-gray-700 mb-2">{{ $t('portfolioTracker.eurToUsd') }}</label>
            <input
              id="eur-to-usd"
              v-model.number="form.eurToUsd"
              type="number"
              step="0.0001"
              min="0.0001"
              class="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              :class="{ 'border-red-500': errors.eurToUsd }"
            />
            <p v-if="errors.eurToUsd" class="mt-1 text-sm text-red-600">{{ errors.eurToUsd }}</p>
            <p class="mt-1 text-xs text-gray-500">{{ $t('portfolioTracker.eurToUsdDesc') }}</p>
            <p class="mt-1 text-xs text-gray-400">
              {{ $t('portfolioTracker.usdToEur') }}: {{ derivedUsdToEur }}
            </p>
          </div>
        </div>

        <!-- Base Currency -->
        <div>
          <label for="base-currency" class="block text-sm font-medium text-gray-700 mb-2">{{ $t('portfolioTracker.baseCurrency') }}</label>
          <select
            id="base-currency"
            v-model="form.baseCurrency"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
          <p class="mt-1 text-xs text-gray-500">{{ $t('portfolioTracker.baseCurrencyDesc') }}</p>
        </div>

        <!-- Total Invested -->
        <div>
          <label for="total-invested" class="block text-sm font-medium text-gray-700 mb-2">
            {{ $t('portfolioTracker.totalInvested') }} <span class="text-red-500">*</span>
          </label>
          <input
            id="total-invested"
            v-model.number="form.totalInvested"
            type="number"
            step="0.01"
            min="0"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            :class="{ 'border-red-500': errors.totalInvested }"
          />
          <p v-if="errors.totalInvested" class="mt-1 text-sm text-red-600">{{ errors.totalInvested }}</p>
          <p class="mt-1 text-xs text-gray-500">{{ $t('portfolioTracker.totalInvestedDesc') }}</p>
        </div>

        <!-- Total Cash -->
        <div>
          <label for="total-cash" class="block text-sm font-medium text-gray-700 mb-2">
            {{ $t('portfolioTracker.totalCash') }} <span class="text-red-500">*</span>
          </label>
          <input
            id="total-cash"
            v-model.number="form.cash"
            type="number"
            step="0.01"
            min="0"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            :class="{ 'border-red-500': errors.cash }"
          />
          <p v-if="errors.cash" class="mt-1 text-sm text-red-600">{{ errors.cash }}</p>
          <p class="mt-1 text-xs text-gray-500">{{ $t('portfolioTracker.totalCashDesc') }}</p>
        </div>

        <!-- Error Message -->
        <div v-if="submitError" class="bg-red-50 border border-red-200 rounded-lg p-3">
          <p class="text-sm text-red-600">{{ submitError }}</p>
        </div>

        <!-- Success Message -->
        <div v-if="submitSuccess" class="bg-green-50 border border-green-200 rounded-lg p-3">
          <p class="text-sm text-green-600">{{ submitSuccess }}</p>
        </div>

        <!-- Form Actions -->
        <div class="flex gap-3 pt-4">
          <button
            type="submit"
            :disabled="submitting"
            class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            <span v-if="submitting">{{ $t('common.saving') }}</span>
            <span v-else>{{ $t('common.save') }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePortfolioStore } from '@/stores/portfolio'
import { useI18n } from 'vue-i18n'

const portfolioStore = usePortfolioStore()
const { t } = useI18n()

const form = ref({
  baseCurrency: 'USD' as 'EUR' | 'USD',
  eurToUsd: 1.0,
  totalInvested: 0,
  cash: 0
})

const derivedUsdToEur = computed(() => {
  const rate = form.value.eurToUsd
  if (rate == null || rate <= 0) return '—'
  return (1 / rate).toFixed(4)
})

const errors = ref({
  totalInvested: '',
  cash: '',
  eurToUsd: ''
})

const submitting = ref(false)
const submitError = ref('')
const submitSuccess = ref('')

onMounted(async () => {
  await portfolioStore.fetchAccount()
  if (portfolioStore.account) {
    form.value = {
      baseCurrency: (portfolioStore.account.baseCurrency as 'EUR' | 'USD') || 'USD',
      eurToUsd: portfolioStore.account.eurToUsd ?? 1.0,
      totalInvested: portfolioStore.account.totalInvested ?? 0,
      cash: portfolioStore.account.cash ?? 0
    }
  }
})

const validateForm = (): boolean => {
  errors.value = { totalInvested: '', cash: '', eurToUsd: '' }
  
  if (form.value.eurToUsd != null && form.value.eurToUsd <= 0) {
    errors.value.eurToUsd = t('portfolioTracker.exchangeRateInvalid')
    return false
  }
  if (form.value.totalInvested < 0) {
    errors.value.totalInvested = t('portfolioTracker.totalInvestedInvalid')
    return false
  }
  if (form.value.cash < 0) {
    errors.value.cash = t('portfolioTracker.totalCashInvalid')
    return false
  }
  return true
}

const handleSubmit = async () => {
  if (!validateForm()) return

  submitting.value = true
  submitError.value = ''
  submitSuccess.value = ''

  try {
    const eurToUsd = form.value.eurToUsd ?? 1
    await portfolioStore.updateAccount({
      baseCurrency: form.value.baseCurrency,
      eurToUsd,
      usdToEur: eurToUsd > 0 ? 1 / eurToUsd : 1,
      totalInvested: form.value.totalInvested,
      cash: form.value.cash
    })
    submitSuccess.value = t('portfolioTracker.accountUpdated')
    setTimeout(() => {
      submitSuccess.value = ''
    }, 3000)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('portfolioTracker.updateError')
    submitError.value = errorMessage
    console.error('Error updating account:', error)
  } finally {
    submitting.value = false
  }
}
</script>

