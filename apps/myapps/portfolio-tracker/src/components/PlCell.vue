<script setup lang="ts">
import { computed } from 'vue'
import type { Money } from '../../../src/types/portfolio-tracker/firestore'
import { useMoneyFormat } from '../../../src/composables/portfolio-tracker/useMoneyFormat'

const props = defineProps<{
  pl: Money
  plPct: number
}>()

const { format } = useMoneyFormat()

type Direction = 'positive' | 'negative' | 'flat'

const direction = computed<Direction>(() => {
  if (props.pl.amount > 0) return 'positive'
  if (props.pl.amount < 0) return 'negative'
  return 'flat'
})

const arrow = computed(() => {
  if (direction.value === 'positive') return '▲'
  if (direction.value === 'negative') return '▼'
  return ''
})

const colorVar = computed(() => {
  if (direction.value === 'positive') return 'var(--positive)'
  if (direction.value === 'negative') return 'var(--negative)'
  return 'var(--muted)'
})

const formattedAmount = computed(() =>
  format(props.pl, { signDisplay: direction.value === 'flat' ? 'auto' : 'exceptZero' }),
)

const pctFormatter = new Intl.NumberFormat('en-US', {
  signDisplay: 'exceptZero',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
const formattedPct = computed(() => `${pctFormatter.format(props.plPct)}%`)

const ariaLabel = computed(() => {
  const directionWord = direction.value === 'positive' ? 'up' : direction.value === 'negative' ? 'down' : 'flat'
  return `${directionWord} ${formattedAmount.value} (${formattedPct.value})`
})
</script>

<template>
  <span
    data-testid="pl-cell"
    class="inline-flex items-center gap-1 tabular-nums"
    :style="{ color: colorVar }"
    :aria-label="ariaLabel"
  >
    <span v-if="arrow" aria-hidden="true">{{ arrow }}</span>
    <span>{{ formattedAmount }}</span>
    <span class="text-sm">({{ formattedPct }})</span>
  </span>
</template>
