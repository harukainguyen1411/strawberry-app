<template>
  <!-- Undismissable modal — renders when show=true -->
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-[100] flex items-center justify-center"
      data-testid="modal-backdrop"
      @click.self.prevent
      @keydown.esc.prevent
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0"
        style="background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);"
        aria-hidden="true"
      />

      <!-- Dialog -->
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="currency-picker-title"
        class="relative w-full max-w-sm mx-4 ds-glass rounded-2xl p-8"
        @keydown.esc.prevent
      >
        <h2
          id="currency-picker-title"
          class="text-xl font-semibold mb-2"
          style="color: var(--text);"
        >
          Pick your base currency
        </h2>
        <p class="text-sm mb-6" style="color: var(--muted);">
          All totals and P/L will be shown in this currency.
        </p>

        <!-- Radio group -->
        <div
          role="radiogroup"
          aria-labelledby="currency-picker-title"
          class="flex gap-4 mb-6"
        >
          <label
            v-for="opt in options"
            :key="opt.value"
            class="flex items-center gap-2 cursor-pointer select-none"
            :data-testid="`radio-${opt.value}`"
            :aria-checked="selected === opt.value ? 'true' : 'false'"
            :role="'radio'"
          >
            <input
              type="radio"
              :value="opt.value"
              :checked="selected === opt.value"
              name="baseCurrency"
              class="sr-only"
              @change="selected = opt.value as 'USD' | 'EUR'"
            />
            <!-- Visual radio -->
            <span
              class="flex items-center justify-center w-5 h-5 rounded-full border-2 transition-colors"
              :style="selected === opt.value
                ? 'border-color: var(--accent); background: var(--accent);'
                : 'border-color: var(--border-hi); background: transparent;'"
              aria-hidden="true"
            >
              <span
                v-if="selected === opt.value"
                class="w-2 h-2 rounded-full bg-white"
              />
            </span>
            <span class="text-sm font-medium" style="color: var(--text);">
              {{ opt.label }}
            </span>
          </label>
        </div>

        <p class="text-xs mb-6" style="color: var(--muted);">
          You can change this later in Settings.
        </p>

        <button
          data-testid="continue-btn"
          :disabled="!selected || saving"
          class="ds-btn-primary w-full"
          @click="handleConfirm"
        >
          {{ saving ? 'Saving…' : 'Continue →' }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { CurrencyCode } from '@/types/firestore'

defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  confirm: [currency: CurrencyCode]
}>()

const options = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
]

const selected = ref<CurrencyCode | null>(null)
const saving = ref(false)

async function handleConfirm() {
  if (!selected.value || saving.value) return
  saving.value = true
  try {
    emit('confirm', selected.value)
  } finally {
    saving.value = false
  }
}
</script>
