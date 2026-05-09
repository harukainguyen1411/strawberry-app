<script setup lang="ts">
import { computed } from 'vue'
import type { CurrencyCode, Money } from '@/types/firestore'
import { useMoneyFormat } from '@/composables/useMoneyFormat'

const props = withDefaults(
  defineProps<{
    money: Money
    baseCurrency?: CurrencyCode
    // showCurrencyBadge is retained for API compatibility but the badge is no
    // longer rendered — the Intl currency symbol ($ / €) already disambiguates.
    showCurrencyBadge?: boolean
  }>(),
  { showCurrencyBadge: false },
)

const { format } = useMoneyFormat()

const formatted = computed(() => format(props.money))
</script>

<template>
  <span class="inline-flex items-baseline gap-1">
    <span class="tabular-nums">{{ formatted }}</span>
  </span>
</template>
