<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-start py-12 px-4">
    <div class="w-full max-w-2xl">
      <div class="mb-6 flex items-center gap-3">
        <button
          class="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          @click="router.push({ name: 'bee-home' })"
        >
          &#8592; Quay lại
        </button>
        <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Lịch sử công việc</h1>
      </div>

      <div v-if="!authStore.user" class="text-center py-16 text-gray-400">
        Vui lòng đăng nhập để xem lịch sử.
      </div>

      <div v-else-if="loading" class="flex justify-center py-16">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
      </div>

      <div v-else-if="jobHistory.length === 0" class="text-center py-16 text-gray-400 dark:text-gray-500">
        Chưa có công việc nào.
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="job in jobHistory"
          :key="job.number"
          class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 flex items-center justify-between gap-4 cursor-pointer hover:border-amber-300 dark:hover:border-amber-600 transition-colors"
          @click="router.push({ name: 'bee-job', params: { id: job.number } })"
        >
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {{ job.title || '(Không có yêu cầu)' }}
            </p>
            <p class="text-xs text-gray-400 mt-1">{{ job.createdAt }}</p>
          </div>
          <span :class="job.closedAt ? doneClass : openClass">
            {{ job.closedAt ? 'Hoàn thành' : 'Đang xử lý' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useBee } from '@/composables/useBee'

const router = useRouter()
const authStore = useAuthStore()
const { jobHistory, loadHistory } = useBee()
const loading = ref(true)

const doneClass = 'px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
const openClass = 'px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'

onMounted(async () => {
  if (authStore.user) {
    await loadHistory()
  }
  loading.value = false
})
</script>
