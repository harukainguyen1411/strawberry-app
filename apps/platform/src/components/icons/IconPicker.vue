<template>
  <div v-if="open" class="fixed inset-0 z-[100] flex items-center justify-center p-4"
       @click.self="$emit('close')">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="$emit('close')"></div>

    <!-- Modal -->
    <div class="relative ds-glass w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden rounded-2xl">
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-ds-border/30">
        <h3 class="font-display text-lg font-semibold text-ds-text">Choose Icon</h3>
        <button @click="$emit('close')" class="text-ds-muted hover:text-ds-text transition-colors p-1">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Preview + Color -->
      <div class="px-5 py-4 border-b border-ds-border/30 flex items-center gap-5">
        <div class="w-16 h-16 rounded-xl flex items-center justify-center"
             :style="{ backgroundColor: selectedColor + '15' }">
          <AppIcon :name="selectedIcon" :color="selectedColor" :size="36" :fallback="fallback" />
        </div>
        <div class="flex-1">
          <p class="text-xs text-ds-muted mb-2">Color</p>
          <div class="flex gap-2 flex-wrap">
            <button
              v-for="c in brandColors"
              :key="c.hex"
              @click="selectedColor = c.hex"
              class="w-7 h-7 rounded-full border-2 transition-all duration-150"
              :class="selectedColor === c.hex ? 'border-white scale-110' : 'border-transparent hover:scale-105'"
              :style="{ backgroundColor: c.hex }"
              :title="c.name"
            ></button>
            <div class="relative">
              <input
                type="color"
                v-model="selectedColor"
                class="w-7 h-7 rounded-full cursor-pointer appearance-none border-2 border-ds-border bg-transparent"
                title="Custom color"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Search -->
      <div class="px-5 py-3 border-b border-ds-border/30">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search icons..."
          class="w-full bg-ds-surface border border-ds-border rounded-lg px-3 py-2 text-sm text-ds-text
                 placeholder-ds-muted/50 focus:outline-none focus:border-ds-accent focus:ring-1 focus:ring-ds-accent/30"
        />
      </div>

      <!-- Categories + Icons -->
      <div class="flex-1 overflow-y-auto px-5 py-3">
        <template v-if="searchQuery.trim()">
          <div class="grid grid-cols-8 gap-1.5">
            <button
              v-for="icon in searchResults"
              :key="icon"
              @click="selectIcon(icon)"
              class="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150
                     hover:bg-ds-surface-hi/50"
              :class="selectedIcon === icon ? 'bg-ds-accent/20 ring-1 ring-ds-accent' : ''"
              :title="icon"
            >
              <AppIcon :name="icon" :color="selectedIcon === icon ? selectedColor : '#9ca3af'" :size="18" />
            </button>
          </div>
          <p v-if="searchResults.length === 0" class="text-sm text-ds-muted text-center py-4">
            No icons found.
          </p>
        </template>
        <template v-else>
          <div v-for="(icons, category) in iconCategories" :key="category" class="mb-5">
            <p class="text-xs font-medium uppercase tracking-widest text-ds-muted mb-2">{{ category }}</p>
            <div class="grid grid-cols-8 gap-1.5">
              <button
                v-for="icon in icons"
                :key="icon"
                @click="selectIcon(icon)"
                class="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150
                       hover:bg-ds-surface-hi/50"
                :class="selectedIcon === icon ? 'bg-ds-accent/20 ring-1 ring-ds-accent' : ''"
                :title="icon"
              >
                <AppIcon :name="icon" :color="selectedIcon === icon ? selectedColor : '#9ca3af'" :size="18" />
              </button>
            </div>
          </div>
        </template>
      </div>

      <!-- Footer -->
      <div class="px-5 py-3 border-t border-ds-border/30 flex items-center justify-between">
        <button
          @click="$emit('request-custom')"
          class="text-xs text-ds-muted hover:text-ds-text transition-colors"
        >
          Need a custom icon?
        </button>
        <div class="flex gap-2">
          <button @click="$emit('close')" class="px-4 py-2 text-sm text-ds-muted hover:text-ds-text transition-colors">
            Cancel
          </button>
          <button
            @click="confirm"
            class="ds-btn-primary px-4 py-2 rounded-xl text-sm font-medium"
          >
            Select
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import AppIcon from './AppIcon.vue'
import { brandColors, iconCategories } from './iconData'

const props = withDefaults(defineProps<{
  open: boolean
  initialIcon?: string
  initialColor?: string
  fallback?: string
}>(), {
  initialIcon: '',
  initialColor: '#e8614a',
  fallback: '?'
})

const emit = defineEmits<{
  close: []
  select: [icon: { name: string; color: string }]
  'request-custom': []
}>()

const selectedIcon = ref(props.initialIcon)
const selectedColor = ref(props.initialColor)
const searchQuery = ref('')

// Flatten all category icons for search
const allIcons = computed(() => {
  const set = new Set<string>()
  for (const icons of Object.values(iconCategories)) {
    for (const icon of icons) set.add(icon)
  }
  return Array.from(set)
})

const searchResults = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return allIcons.value
  return allIcons.value.filter(icon => icon.includes(q))
})

function selectIcon(icon: string) {
  selectedIcon.value = icon
}

function confirm() {
  if (selectedIcon.value) {
    emit('select', { name: selectedIcon.value, color: selectedColor.value })
  }
  emit('close')
}
</script>
