<script setup lang="ts">
import { computed } from 'vue'
import type { CurrencyCode, Money } from '@/types/firestore'
import { useMoneyFormat } from '@/composables/useMoneyFormat'

const props = withDefaults(
  defineProps<{
    money: Money
    baseCurrency?: CurrencyCode
    showCurrencyBadge?: boolean
  }>(),
  { showCurrencyBadge: false },
)

const { format } = useMoneyFormat()

const formatted = computed(() => format(props.money))

const showBadge = computed(
  () => props.showCurrencyBadge && !!props.baseCurrency && props.money.currency !== props.baseCurrency,
)
</script>

<template>
  <span class="inline-flex items-baseline gap-1">
    <span class="tabular-nums">{{ formatted }}</span>
    <span
      v-if="showBadge"
      data-testid="currency-badge"
      class="text-xs uppercase"
      style="color: var(--muted);"
    >{{ money.currency }}</span>
  </span>
</template>
