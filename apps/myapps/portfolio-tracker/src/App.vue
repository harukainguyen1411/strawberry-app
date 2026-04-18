<template>
  <div id="app" class="min-h-screen">
    <!-- Portfolio v0 shell -->
    <AppShell>
      <!-- BaseCurrencyPicker guard: undismissable until user picks USD or EUR -->
      <BaseCurrencyPicker
        :show="showCurrencyPicker"
        @confirm="onCurrencyConfirm"
      />

      <!-- Router view — rendered but inert while picker is showing -->
      <div :inert="showCurrencyPicker || undefined">
        <RouterView />
      </div>
    </AppShell>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterView } from 'vue-router'
import AppShell from './components/AppShell.vue'
import BaseCurrencyPicker from './components/BaseCurrencyPicker.vue'
import { useAuth } from './composables/useAuth'
import { useBaseCurrency } from './composables/useBaseCurrency'
import type { CurrencyCode } from './types/firestore'

const { isAuthenticated } = useAuth()
const { baseCurrency, setBaseCurrency } = useBaseCurrency()

// Show picker if signed in and baseCurrency not yet set
const showCurrencyPicker = computed(
  () => isAuthenticated.value && baseCurrency.value === null
)

async function onCurrencyConfirm(currency: CurrencyCode) {
  await setBaseCurrency(currency)
}
</script>
