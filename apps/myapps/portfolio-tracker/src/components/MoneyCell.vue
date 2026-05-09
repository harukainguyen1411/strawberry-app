<script setup lang="ts">
import { computed } from 'vue'
import type { CurrencyCode, Money } from '@/types/firestore'
import { useMoneyFormat } from '@/composables/useMoneyFormat'

// V0.1.3: showCurrencyBadge prop dropped — the Intl currency symbol ($ / €)
// already disambiguates, so the trailing code suffix is redundant.
// baseCurrency is retained for callers that may want to thread it later.
const props = defineProps<{
  money: Money
  baseCurrency?: CurrencyCode
}>()

const { format } = useMoneyFormat()

const formatted = computed(() => format(props.money))
</script>

<template>
  <span class="inline-flex items-baseline gap-1">
    <span class="tabular-nums">{{ formatted }}</span>
  </span>
</template>
