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

      <div v-if="loading" class="flex justify-center py-16">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
      </div>

      <div v-else-if="currentJob" class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 space-y-5">
        <!-- Status badge -->
        <div class="flex items-center gap-3">
          <span class="text-sm font-medium text-gray-500 dark:text-gray-400">Trạng thái:</span>
          <span :class="statusBadgeClass">{{ statusLabel }}</span>
        </div>

        <!-- Spinner while open -->
        <div v-if="currentJob.state === 'open'" class="flex items-center gap-2 text-sm text-gray-500">
          <span class="animate-spin h-4 w-4 border-2 border-amber-400 border-t-transparent rounded-full"></span>
          Bee đang xử lý tài liệu của bạn, vui lòng chờ...
        </div>

        <!-- Answer when done -->
        <div v-if="currentJob.answer" class="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 text-sm text-green-800 dark:text-green-300 whitespace-pre-wrap">
          {{ currentJob.answer }}
        </div>

        <!-- Download button if docx available -->
        <div v-if="currentJob.resultDocxUrl" class="space-y-3">
          <p class="text-sm text-green-700 dark:text-green-400 font-medium">
            Tài liệu đã được xử lý thành công!
          </p>
          <a
            :href="currentJob.resultDocxUrl"
            target="_blank"
            rel="noopener"
            class="block w-full text-center bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl py-3 px-6 text-sm transition-colors"
          >
            &#128229; Tải xuống tài liệu
          </a>
        </div>

        <!-- Job metadata -->
        <div class="pt-4 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 space-y-1">
          <p>Issue #{{ currentJob.issueNumber }}</p>
          <p>Labels: {{ currentJob.labels.join(', ') }}</p>
        </div>
      </div>

      <div v-else class="text-center py-16 text-gray-400 dark:text-gray-500">
        Không tìm thấy công việc.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBee } from '@/composables/useBee'

const route = useRoute()
const router = useRouter()
const issueNumber = Number(route.params.id)

const { currentJob, startPolling, stopPolling } = useBee()
const loading = ref(true)

onMounted(() => {
  startPolling(issueNumber)
  loading.value = false
})

onUnmounted(() => {
  stopPolling()
})

const isDone = computed(() =>
  currentJob.value?.labels.includes('done') || currentJob.value?.state === 'closed'
)

const statusLabel = computed(() => {
  if (!currentJob.value) return ''
  if (isDone.value) return 'Hoàn thành'
  if (currentJob.value.labels.includes('failed')) return 'Thất bại'
  if (currentJob.value.labels.includes('running')) return 'Đang xử lý'
  return 'Đang chờ'
})

const statusBadgeClass = computed(() => {
  const base = 'px-3 py-1 rounded-full text-xs font-semibold'
  if (!currentJob.value) return base
  if (isDone.value) return `${base} bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300`
  if (currentJob.value.labels.includes('failed')) return `${base} bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300`
  if (currentJob.value.labels.includes('running')) return `${base} bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300`
  return `${base} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300`
})
</script>
