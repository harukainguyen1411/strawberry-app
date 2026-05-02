<script setup lang="ts">
import type { CurrencyCode, Holding } from '@/types/firestore'
import MoneyCell from '@/components/MoneyCell.vue'
import PlCell from '@/components/PlCell.vue'

defineProps<{
  holding: Holding
  baseCurrency: CurrencyCode
}>()
</script>

<template>
  <li
    data-testid="holding-row"
    class="flex flex-col gap-1 py-4 px-5 min-h-[44px] border-b"
    :style="{ borderColor: 'var(--border)' }"
  >
    <div class="flex items-baseline justify-between">
      <span class="text-base font-medium">{{ holding.ticker }}</span>
      <span class="text-xs uppercase" style="color: var(--muted);">{{ holding.broker }}</span>
    </div>
    <div class="text-sm flex items-baseline gap-2" style="color: var(--muted);">
      <span>{{ holding.quantity }} ·</span>
      <span class="inline-flex items-baseline gap-1">
        avg
        <MoneyCell
          :money="holding.avgCost"
          :base-currency="baseCurrency"
          show-currency-badge
        />
      </span>
    </div>
    <div class="flex items-center justify-between">
      <span class="text-base">
        <MoneyCell :money="holding.marketValue" />
      </span>
      <PlCell :pl="holding.pl" :pl-pct="holding.plPct" />
    </div>
  </li>
</template>
