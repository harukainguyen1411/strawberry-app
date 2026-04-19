<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    @click.self="handleCancel"
  >
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">
        {{ $t('localMode.syncModal.title') }}
      </h2>
      <p class="text-sm text-gray-600 mb-6">
        {{ $t('localMode.syncModal.message') }}
      </p>
      
      <div class="space-y-3">
        <button
          @click="handleStrategy('useAccount')"
          class="w-full px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
        >
          <div class="font-medium text-gray-900 mb-1">
            {{ $t('localMode.syncModal.useAccount') }}
          </div>
          <div class="text-xs text-gray-500">
            {{ $t('localMode.syncModal.useAccountDesc') }}
          </div>
        </button>
        
        <button
          @click="handleStrategy('merge')"
          class="w-full px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
        >
          <div class="font-medium text-gray-900 mb-1">
            {{ $t('localMode.syncModal.merge') }}
          </div>
          <div class="text-xs text-gray-500">
            {{ $t('localMode.syncModal.mergeDesc') }}
          </div>
        </button>
      </div>
      
      <button
        @click="handleCancel"
        class="mt-6 w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
      >
        {{ $t('common.cancel') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineEmits, defineProps } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SyncStrategy } from '@/utils/dataSync'

defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'strategy', strategy: SyncStrategy): void
  (e: 'cancel'): void
}>()

useI18n()

const handleStrategy = (strategy: SyncStrategy): void => {
  emit('strategy', strategy)
}

const handleCancel = (): void => {
  emit('cancel')
}
</script>
