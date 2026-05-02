<template>
  <div
    role="status"
    class="rounded-lg px-4 py-3 text-sm cursor-pointer select-none"
    :style="bannerStyle"
    :aria-expanded="expanded ? 'true' : 'false'"
    @click="toggle"
  >
    <div class="flex items-center justify-between gap-3">
      <span class="font-medium" style="color: var(--text);">
        ⚠ {{ message }}
      </span>
      <span v-if="details && details.length" class="text-xs" style="color: var(--muted);">
        {{ expanded ? 'Hide' : 'See details' }}
      </span>
    </div>
    <ul
      v-if="expanded && details && details.length"
      data-testid="warn-details"
      class="mt-2 space-y-1 text-xs list-disc pl-5"
      style="color: var(--muted);"
    >
      <li v-for="(line, i) in details" :key="i">{{ line }}</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  count: number
  message: string
  details?: string[]
}>()

const expanded = ref(false)

function toggle() {
  if (props.details && props.details.length) {
    expanded.value = !expanded.value
  }
}

const bannerStyle = computed(() => ({
  border: '1px solid var(--warn, #d4a017)',
  background: 'color-mix(in srgb, var(--warn, #d4a017) 12%, transparent)',
}))
</script>
