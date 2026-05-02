<template>
  <div
    role="alert"
    class="rounded-lg px-4 py-3 text-sm"
    :style="bannerStyle"
  >
    <p class="font-medium mb-1" style="color: var(--accent);">
      {{ title || 'Could not parse CSV' }}
    </p>
    <p v-if="message" style="color: var(--text);">{{ message }}</p>
    <div v-if="expectedHeaders && expectedHeaders.length" class="mt-2 text-xs" style="color: var(--muted);">
      <p class="font-medium mb-0.5">Expected headers:</p>
      <p class="font-mono break-all">{{ expectedHeaders.join(', ') }}</p>
    </div>
    <div v-if="receivedHeaders && receivedHeaders.length" class="mt-2 text-xs" style="color: var(--muted);">
      <p class="font-medium mb-0.5">Received:</p>
      <p class="font-mono break-all">{{ receivedHeaders.join(', ') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

defineProps<{
  title?: string
  message?: string
  expectedHeaders?: string[]
  receivedHeaders?: string[]
}>()

const bannerStyle = computed(() => ({
  border: '1px solid var(--accent)',
  background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
}))
</script>
