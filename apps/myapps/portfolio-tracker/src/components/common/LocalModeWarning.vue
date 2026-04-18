<template>
  <div
    v-if="showWarning"
    class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4"
  >
    <div class="flex">
      <div class="flex-shrink-0">
        <svg
          class="h-5 w-5 text-yellow-400"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clip-rule="evenodd"
          />
        </svg>
      </div>
      <div class="ml-3 flex-1">
        <p class="text-sm text-yellow-700">
          {{ $t('localMode.warning') }}
        </p>
        <div class="mt-2 text-sm text-yellow-700">
          <ul class="list-disc list-inside space-y-1">
            <li>{{ $t('localMode.warningPoint1') }}</li>
            <li>{{ $t('localMode.warningPoint2') }}</li>
            <li>{{ $t('localMode.warningPoint3') }}</li>
          </ul>
        </div>
      </div>
      <div class="ml-auto pl-3">
        <div class="-mx-1.5 -my-1.5">
          <button
            @click="dismissWarning"
            class="inline-flex rounded-md bg-yellow-50 p-1.5 text-yellow-500 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:ring-offset-2 focus:ring-offset-yellow-50"
          >
            <span class="sr-only">{{ $t('common.close') }}</span>
            <svg
              class="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const dismissedKey = 'readTracker_localModeWarningDismissed'
const dismissed = ref(false)

const showWarning = computed(() => {
  return authStore.localMode && !dismissed.value
})

const dismissWarning = () => {
  dismissed.value = true
  localStorage.setItem(dismissedKey, 'true')
}

onMounted(() => {
  const stored = localStorage.getItem(dismissedKey)
  dismissed.value = stored === 'true'
})
</script>
