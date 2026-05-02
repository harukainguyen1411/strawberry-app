<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CurrencyCode, Holding } from '@/types/firestore'
import MoneyCell from '@/components/MoneyCell.vue'
import PlCell from '@/components/PlCell.vue'
import HoldingRow from '@/components/HoldingRow.vue'

const props = defineProps<{
  holdings: Holding[]
  baseCurrency: CurrencyCode
}>()

type SortKey = 'ticker' | 'broker' | 'quantity' | 'avgCost' | 'marketValue' | 'pl' | 'plPct'
type Direction = 'ascending' | 'descending'

const sortKey = ref<SortKey>('marketValue')
const sortDir = ref<Direction>('descending')

interface ColumnDef {
  key: SortKey
  label: string
  align: 'left' | 'right'
}

const columns: ColumnDef[] = [
  { key: 'ticker', label: 'Ticker', align: 'left' },
  { key: 'broker', label: 'Broker', align: 'left' },
  { key: 'quantity', label: 'Qty', align: 'right' },
  { key: 'avgCost', label: 'Avg cost', align: 'right' },
  { key: 'marketValue', label: 'Market value', align: 'right' },
  { key: 'pl', label: 'P/L', align: 'right' },
  { key: 'plPct', label: 'P/L %', align: 'right' },
]

function valueFor(h: Holding, key: SortKey): number | string {
  switch (key) {
    case 'ticker': return h.ticker
    case 'broker': return h.broker
    case 'quantity': return h.quantity
    case 'avgCost': return h.avgCost.amount
    case 'marketValue': return h.marketValue.amount
    case 'pl': return h.pl.amount
    case 'plPct': return h.plPct
  }
}

const sorted = computed(() => {
  const list = [...props.holdings]
  const dir = sortDir.value === 'ascending' ? 1 : -1
  list.sort((a, b) => {
    const av = valueFor(a, sortKey.value)
    const bv = valueFor(b, sortKey.value)
    if (typeof av === 'string' && typeof bv === 'string') {
      return av.localeCompare(bv) * dir
    }
    return ((av as number) - (bv as number)) * dir
  })
  return list
})

function ariaSortFor(key: SortKey): 'ascending' | 'descending' | 'none' {
  if (sortKey.value !== key) return 'none'
  return sortDir.value
}

function onHeaderClick(key: SortKey): void {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'ascending' ? 'descending' : 'ascending'
    return
  }
  sortKey.value = key
  sortDir.value = key === 'ticker' || key === 'broker' ? 'ascending' : 'descending'
}
</script>

<template>
  <div>
    <table class="hidden md:table w-full text-sm" style="color: var(--text);">
      <thead class="sticky top-0" style="background: var(--surface-hi);">
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            scope="col"
            :data-sort-key="col.key"
            :aria-sort="ariaSortFor(col.key)"
            class="px-3 py-2 cursor-pointer select-none font-medium uppercase tracking-wide text-xs"
            :class="col.align === 'right' ? 'text-right' : 'text-left'"
            style="color: var(--muted);"
            @click="onHeaderClick(col.key)"
          >
            {{ col.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="h in sorted"
          :key="`${h.broker}-${h.ticker}`"
          class="border-b hover:bg-[var(--surface-hi)]"
          :style="{ borderColor: 'var(--border)' }"
        >
          <td class="px-3 py-3 font-medium">{{ h.ticker }}</td>
          <td class="px-3 py-3 text-xs uppercase" style="color: var(--muted);">{{ h.broker }}</td>
          <td class="px-3 py-3 text-right tabular-nums">{{ h.quantity }}</td>
          <td class="px-3 py-3 text-right">
            <MoneyCell
              :money="h.avgCost"
              :base-currency="baseCurrency"
              show-currency-badge
            />
          </td>
          <td class="px-3 py-3 text-right">
            <MoneyCell :money="h.marketValue" />
          </td>
          <td class="px-3 py-3 text-right" colspan="2">
            <PlCell :pl="h.pl" :pl-pct="h.plPct" />
          </td>
        </tr>
      </tbody>
    </table>

    <ul
      data-testid="holdings-mobile-list"
      class="md:hidden flex flex-col"
    >
      <HoldingRow
        v-for="h in sorted"
        :key="`${h.broker}-${h.ticker}`"
        :holding="h"
        :base-currency="baseCurrency"
      />
    </ul>
  </div>
</template>
