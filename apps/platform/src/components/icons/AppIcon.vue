<template>
  <span class="inline-flex items-center justify-center" :style="{ width: `${size}px`, height: `${size}px` }">
    <!-- Custom SVG icon (highest priority) -->
    <span v-if="customSvg" v-html="customSvg" class="flex items-center justify-center" :style="iconStyle"></span>
    <!-- Lucide icon by name -->
    <component v-else-if="iconComponent" :is="iconComponent" :size="size" :color="color" :stroke-width="strokeWidth" />
    <!-- Fallback: first-letter avatar -->
    <span v-else
          class="rounded-lg flex items-center justify-center font-display font-bold"
          :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${size * 0.5}px`,
                    backgroundColor: color + '20', color: color }">
      {{ fallbackLetter }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed, shallowRef, watchEffect } from 'vue'
import { icons } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  name?: string
  color?: string
  size?: number
  strokeWidth?: number
  customSvg?: string
  fallback?: string
}>(), {
  color: '#e8614a',
  size: 32,
  strokeWidth: 2,
  fallback: '?'
})

const iconComponent = shallowRef<any>(null)

watchEffect(() => {
  if (props.name && !props.customSvg) {
    // Convert kebab-case to PascalCase for lucide lookup
    const pascalName = props.name
      .split('-')
      .map(s => s.charAt(0).toUpperCase() + s.slice(1))
      .join('')
    iconComponent.value = (icons as Record<string, any>)[pascalName] || null
  } else {
    iconComponent.value = null
  }
})

const iconStyle = computed(() => ({
  color: props.color,
  width: `${props.size}px`,
  height: `${props.size}px`
}))

const fallbackLetter = computed(() => props.fallback.charAt(0).toUpperCase())
</script>
