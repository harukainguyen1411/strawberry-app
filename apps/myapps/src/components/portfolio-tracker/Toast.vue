<template>
  <Transition name="toast">
    <div
      v-if="show"
      data-testid="toast"
      role="status"
      aria-live="polite"
      class="fixed z-[110] px-4 py-3 rounded-lg text-sm shadow-lg flex items-center gap-3"
      :class="positionClasses"
      :style="toastStyle"
    >
      <span style="color: var(--text);">{{ message }}</span>
      <button
        v-if="onRetry"
        data-testid="toast-retry-btn"
        type="button"
        class="ds-btn-ghost text-xs px-2 py-1"
        @click="handleRetry"
      >
        Retry
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    message?: string
    show?: boolean
    duration?: number
    onRetry?: () => void
  }>(),
  {
    message: '',
    show: false,
    duration: 5000,
  },
)

const emit = defineEmits<{
  (e: 'dismiss'): void
}>()

let timer: ReturnType<typeof setTimeout> | null = null

function clearTimer() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

function startTimer() {
  clearTimer()
  if (!props.show || !props.duration) return
  timer = setTimeout(() => emit('dismiss'), props.duration)
}

function handleRetry() {
  if (props.onRetry) props.onRetry()
}

watch(() => props.show, (v) => {
  if (v) startTimer()
  else clearTimer()
})

onMounted(() => {
  if (props.show) startTimer()
})

onBeforeUnmount(clearTimer)

const positionClasses = computed(() => 'left-1/2 -translate-x-1/2 bottom-4 md:left-auto md:right-4 md:translate-x-0 md:top-4 md:bottom-auto')

const toastStyle = computed(() => ({
  background: 'var(--surface-hi, #1c1c2a)',
  border: '1px solid var(--border, rgba(255,255,255,0.08))',
}))
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
