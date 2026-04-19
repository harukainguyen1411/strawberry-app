<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-start py-12 px-4">
    <div class="w-full max-w-xl">
      <div class="mb-6 flex items-center gap-3">
        <button
          class="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          @click="router.push({ name: 'bee-home' })"
        >
          &#8592; Quay lại
        </button>
        <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Trạng thái công việc</h1>
      </div>

      <div v-if="!currentJob" class="flex justify-center py-16">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
      </div>

      <div v-else class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 space-y-5">
        <!-- Status badge -->
        <div class="flex items-center gap-3">
          <span class="text-sm font-medium text-gray-500 dark:text-gray-400">Trạng thái:</span>
          <span :class="statusBadgeClass">{{ statusLabel }}</span>
        </div>

        <!-- Spinner while processing -->
        <div v-if="polling" class="flex items-center gap-2 text-sm text-gray-500">
          <span class="animate-spin h-4 w-4 border-2 border-amber-400 border-t-transparent rounded-full"></span>
          Bee đang xử lý yêu cầu của bạn, vui lòng chờ...
        </div>

        <!-- Answer when done -->
        <div v-if="currentJob.answer" class="space-y-3">
          <p class="text-sm text-green-700 dark:text-green-400 font-medium">
            Yêu cầu đã được xử lý thành công!
          </p>
          <div class="prose prose-sm dark:prose-invert max-w-none" v-html="renderedAnswer"></div>
        </div>

        <!-- Job metadata -->
        <div class="pt-4 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 space-y-1">
          <p>Issue #{{ currentJob.issueNumber }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBee } from '@/composables/useBee'

const route = useRoute()
const router = useRouter()
const issueNumber = Number(route.params.id)

const { currentJob, polling, startPolling, stopPolling } = useBee()

onMounted(() => {
  startPolling(issueNumber)
})

onUnmounted(() => {
  stopPolling()
})

const statusLabel = computed(() => {
  if (!currentJob.value) return ''
  const labels = currentJob.value.labels
  if (labels.includes('done')) return 'Hoàn thành'
  if (labels.includes('bot-in-progress')) return 'Đang xử lý'
  if (labels.includes('ready')) return 'Đang chờ'
  return currentJob.value.state === 'closed' ? 'Đã đóng' : 'Đang chờ'
})

const statusBadgeClass = computed(() => {
  const base = 'px-3 py-1 rounded-full text-xs font-semibold'
  if (!currentJob.value) return base
  const labels = currentJob.value.labels
  if (labels.includes('done')) return `${base} bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300`
  if (labels.includes('bot-in-progress')) return `${base} bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300`
  return `${base} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300`
})

const renderedAnswer = computed(() => {
  if (!currentJob.value?.answer) return ''
  // Simple markdown-like rendering for the answer
  return currentJob.value.answer
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
})
</script>
