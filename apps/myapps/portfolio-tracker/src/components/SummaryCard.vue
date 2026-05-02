<script setup lang="ts">
import { computed } from 'vue'
import type { Money } from '@/types/firestore'
import MoneyCell from '@/components/MoneyCell.vue'
import PlCell from '@/components/PlCell.vue'

const props = defineProps<{
  totalValue: Money
  dayChange: Money | null
  dayChangePct: number | null
  positionsCount: number
  cashTotal: Money
}>()

const hasDayChange = computed(() => props.dayChange !== null && props.dayChangePct !== null)
</script>

<template>
  <section
    class="ds-glass p-5 md:p-6 rounded-2xl"
    :style="{ background: 'var(--surface-hi)', color: 'var(--text)' }"
  >
    <div class="text-xs uppercase tracking-wide" style="color: var(--muted);">Total value</div>

    <div class="mt-1 text-3xl font-medium">
      <MoneyCell :money="totalValue" />
    </div>

    <div data-testid="day-change" class="mt-2 text-sm">
      <template v-if="hasDayChange && dayChange && dayChangePct !== null">
        <PlCell :pl="dayChange" :pl-pct="dayChangePct" />
        <span class="ml-2" style="color: var(--muted);">today</span>
      </template>
      <template v-else>
        <span style="color: var(--muted);">— today</span>
      </template>
    </div>

    <div class="mt-4 text-xs flex items-center gap-3" style="color: var(--muted);">
      <span>Positions: {{ positionsCount }}</span>
      <span aria-hidden="true">·</span>
      <span class="inline-flex items-center gap-1">
        Cash: <MoneyCell :money="cashTotal" />
      </span>
    </div>
  </section>
</template>
