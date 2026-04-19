<template>
  <!--
    SourceSelect — controlled select for CSV source (T212 | IB).
    v-model: 'T212' | 'IB'
    Refs V0.11
  -->
  <div class="relative">
    <select
      :value="modelValue"
      class="w-full appearance-none rounded-lg px-3 py-2.5 pr-8 text-sm font-medium focus:outline-none cursor-pointer"
      style="
        background: var(--surface);
        border: 1px solid var(--border-hi);
        color: var(--text);
      "
      aria-label="Select CSV source"
      @change="onChange"
    >
      <option value="" disabled :selected="!modelValue">Select broker…</option>
      <option value="T212">Trading 212</option>
      <option value="IB">Interactive Brokers</option>
    </select>
    <!-- Chevron icon -->
    <span
      class="pointer-events-none absolute inset-y-0 right-3 flex items-center"
      aria-hidden="true"
      style="color: var(--muted);"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </span>
  </div>
</template>

<script setup lang="ts">
export type CsvSource = 'T212' | 'IB'

defineProps<{
  modelValue: CsvSource | ''
}>()

const emit = defineEmits<{
  'update:modelValue': [value: CsvSource]
}>()

function onChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value as CsvSource
  emit('update:modelValue', val)
}
</script>
