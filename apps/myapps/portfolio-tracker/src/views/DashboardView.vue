<script setup lang="ts">
import { computed } from 'vue'
import { usePortfolio } from '@/composables/usePortfolio'
import SummaryCard from '@/components/SummaryCard.vue'
import HoldingsTable from '@/components/HoldingsTable.vue'
import EmptyState from '@/components/EmptyState.vue'
import type { CurrencyCode, Money } from '@/types/firestore'

const { status, loading, holdings, summary, baseCurrency } = usePortfolio()

const fallbackBase = computed<CurrencyCode>(() => baseCurrency.value ?? 'USD')

const placeholderMoney = computed<Money>(() => ({ amount: 0, currency: fallbackBase.value }))

const isReady = computed(() => status.value === 'ready')

const isEmpty = computed(() =>
  isReady.value
  && holdings.value.length === 0
  && (summary.value?.cashTotal.amount ?? 0) === 0,
)
</script>

<template>
  <main class="px-4 md:px-6 py-4 md:py-6 max-w-5xl mx-auto flex flex-col gap-6">
    <template v-if="loading">
      <SummaryCard
        :total-value="placeholderMoney"
        :day-change="null"
        :day-change-pct="null"
        :positions-count="0"
        :cash-total="placeholderMoney"
        loading
      />
      <HoldingsTable :holdings="[]" :base-currency="fallbackBase" loading />
    </template>

    <template v-else-if="isEmpty">
      <EmptyState
        icon="🍓"
        title="No portfolio data yet"
        body="Import a CSV to get started."
        cta-label="Import CSV →"
        cta-to="/import"
      />
    </template>

    <template v-else-if="isReady && summary">
      <SummaryCard
        :total-value="summary.totalValue"
        :day-change="summary.dayChange"
        :day-change-pct="summary.dayChangePct"
        :positions-count="summary.positionsCount"
        :cash-total="summary.cashTotal"
      />
      <HoldingsTable :holdings="holdings" :base-currency="fallbackBase" />
      <div class="flex">
        <a
          data-testid="reimport-link"
          href="/import?mode=replace"
          class="ds-btn-ghost inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm w-full md:w-auto"
        >
          Re-import CSV
        </a>
      </div>
    </template>
  </main>
</template>
