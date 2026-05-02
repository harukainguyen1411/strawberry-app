<template>
  <button
    type="button"
    class="w-full text-left rounded-lg px-4 py-3 text-sm select-none focus:outline-none focus-visible:ring-2"
    :style="bannerStyle"
    :aria-expanded="hasDetails ? (expanded ? 'true' : 'false') : undefined"
    :aria-controls="hasDetails ? 'warn-banner-details' : undefined"
    :disabled="!hasDetails"
    @click="toggle"
  >
    <div class="flex items-center justify-between gap-3">
      <span class="font-medium" style="color: var(--text);">
        ⚠ {{ message }}
      </span>
      <span v-if="hasDetails" class="text-xs" style="color: var(--muted);">
        {{ expanded ? 'Hide' : 'See details' }}
      </span>
    </div>
    <ul
      v-if="expanded && hasDetails"
      id="warn-banner-details"
      data-testid="warn-details"
      class="mt-2 space-y-1 text-xs list-disc pl-5"
      style="color: var(--muted);"
    >
      <li v-for="(line, i) in details" :key="i">{{ line }}</li>
    </ul>
  </button>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  count: number
  message: string
  details?: string[]
}>()

const expanded = ref(false)
const hasDetails = computed(() => !!(props.details && props.details.length))

function toggle() {
  if (hasDetails.value) {
    expanded.value = !expanded.value
  }
}

const bannerStyle = computed(() => ({
  border: '1px solid var(--warn, #d4a017)',
  background: 'color-mix(in srgb, var(--warn, #d4a017) 12%, transparent)',
  cursor: hasDetails.value ? 'pointer' : 'default',
}))
</script>
