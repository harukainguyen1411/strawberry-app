<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    :aria-label="ariaLabel || name"
    :role="ariaLabel ? 'img' : 'presentation'"
    v-html="iconContent"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { DS_ICONS, type DsIconName } from './icons'

const props = withDefaults(defineProps<{
  name: DsIconName
  size?: number | string
  strokeWidth?: number | string
  ariaLabel?: string
}>(), {
  size: 24,
  strokeWidth: 2,
})

const iconContent = computed(() => DS_ICONS[props.name] ?? '')
</script>
