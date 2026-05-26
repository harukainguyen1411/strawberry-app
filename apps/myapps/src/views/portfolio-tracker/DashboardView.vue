<script setup lang="ts">
import { computed } from 'vue'
import { FxRateMissingError, usePortfolio } from '@/composables/portfolio-tracker/usePortfolio'
import SummaryCard from '@/components/portfolio-tracker/SummaryCard.vue'
import HoldingsTable from '@/components/portfolio-tracker/HoldingsTable.vue'
import EmptyState from '@/components/portfolio-tracker/EmptyState.vue'
import BaseCurrencyPicker from '@/components/portfolio-tracker/BaseCurrencyPicker.vue'
import { useBaseCurrency } from '@/composables/portfolio-tracker/useBaseCurrency'
import { useAuth } from '@/composables/portfolio-tracker/useAuth'
import type { CurrencyCode, Money } from '@/types/portfolio-tracker/firestore'

const { status, loading, holdings, summary, baseCurrency, error } = usePortfolio()
const { setBaseCurrency } = useBaseCurrency()
const { isAuthenticated } = useAuth()

// Show picker if signed in and baseCurrency not yet set
const showCurrencyPicker = computed(
  () => isAuthenticated.value && baseCurrency.value === null
)

async function onCurrencyConfirm(currency: CurrencyCode) {
  await setBaseCurrency(currency)
}

const fallbackBase = computed<CurrencyCode>(() => baseCurrency.value ?? 'USD')

const placeholderMoney = computed<Money>(() => ({ amount: 0, currency: fallbackBase.value }))

const isReady = computed(() => status.value === 'ready')

const isEmpty = computed(() =>
  isReady.value
  && holdings.value.length === 0
  && (summary.value?.cashTotal.amount ?? 0) === 0,
)

// A.6.3 — narrow the FxRateMissingError pair off the generic Error
// surface from usePortfolio so the banner can name the missing rate
// (e.g. "USD->EUR"). Other Error subclasses fall through to a generic
// message via error.message in the template.
const fxPair = computed(() =>
  error.value instanceof FxRateMissingError ? error.value.pair : null,
)
</script>

<template>
  <!-- BaseCurrencyPicker guard: undismissable until user picks USD or EUR.
       Inerts the dashboard content while the picker is showing so focus
       does not escape to background content. -->
  <BaseCurrencyPicker
    :show="showCurrencyPicker"
    @confirm="onCurrencyConfirm"
  />

  <main
    class="px-4 md:px-6 py-4 md:py-6 max-w-5xl mx-auto flex flex-col gap-6"
    :inert="showCurrencyPicker || undefined"
  >
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

    <template v-else-if="status === 'error'">
      <!-- A.6.3 — usePortfolio surfaced an error (most commonly
        FxRateMissingError on a multi-currency import without a seeded
        users/{uid}/meta/fx). Surface the missing pair + Re-import CTA
        so the dashboard does not render a blank <main>. Re-import is the
        primary recovery — pick a base currency that does not require
        conversion. (v1.x will add in-app FX-overrides UI.)

        role="alert" alone implies assertive announcement; aria-live is
        intentionally not set so the role's default behaviour is honoured. -->
      <section
        data-testid="error-banner"
        role="alert"
        class="rounded-lg px-4 py-3 text-sm flex flex-col gap-3"
        :style="{
          border: '1px solid var(--accent)',
          background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
        }"
      >
        <div>
          <p class="font-medium mb-1" style="color: var(--accent);">
            Couldn't load your portfolio
          </p>
          <p style="color: var(--text);">
            <template v-if="fxPair">
              Missing FX rate for <code class="font-mono">{{ fxPair }}</code>.
              Re-import with a base currency that doesn't need conversion.
            </template>
            <template v-else>
              {{ error?.message ?? 'Unknown error' }}
            </template>
          </p>
        </div>
        <div>
          <router-link
            data-testid="error-reimport-link"
            to="/yourApps/portfolio-tracker/import?mode=replace"
            class="ds-btn-ghost inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm"
          >
            Re-import CSV
          </router-link>
        </div>
      </section>
    </template>

    <template v-else-if="isEmpty">
      <EmptyState
        icon="🍓"
        title="No portfolio data yet"
        body="Import a CSV to get started."
        cta-label="Import CSV →"
        cta-to="/yourApps/portfolio-tracker/import"
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
        <router-link
          data-testid="reimport-link"
          to="/yourApps/portfolio-tracker/import?mode=replace"
          class="ds-btn-ghost inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm w-full md:w-auto"
        >
          Re-import CSV
        </router-link>
      </div>
    </template>
  </main>
</template>

