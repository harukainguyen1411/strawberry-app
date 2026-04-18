<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4" @click.self="handleCancel">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full">
      <div class="p-4 sm:p-6">
        <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-primary-100 rounded-full">
          <svg class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <h3 class="text-lg sm:text-xl font-semibold text-gray-900 text-center mb-2">
          {{ $t('sessionPrompt.title') }}
        </h3>
        <p class="text-sm sm:text-base text-gray-600 text-center mb-6">
          {{ $t('sessionPrompt.message') }}
        </p>
        <div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <button
            @click="handleCancel"
            class="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors touch-manipulation"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            @click="handleConfirm"
            class="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors touch-manipulation"
          >
            {{ $t('sessionPrompt.addSession') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

useI18n()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
}
</script>
