<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps<{
  icon: string
  title: string
  body: string
  ctaLabel: string
  ctaTo: string
}>()
</script>

<template>
  <div
    class="flex flex-col items-center justify-center text-center py-16 px-6 gap-4"
    :style="{ color: 'var(--text)' }"
  >
    <div class="text-6xl leading-none" aria-hidden="true">{{ icon }}</div>
    <h2 class="text-xl font-medium">{{ title }}</h2>
    <p class="text-sm" :style="{ color: 'var(--muted)' }">{{ body }}</p>
    <RouterLink
      :to="ctaTo"
      class="ds-btn-primary inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium mt-2"
    >
      {{ ctaLabel }}
    </RouterLink>
  </div>
</template>
