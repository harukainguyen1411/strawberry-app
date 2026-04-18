<template>
  <div class="w-full">
    <LocalModeWarning />

    <div class="mb-4 sm:mb-6 lg:mb-8 flex items-center justify-between">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">{{ $t('taskList.title') }}</h1>
        <p class="text-sm sm:text-base text-gray-600 dark:text-gray-400">{{ $t('taskList.subtitle') }}</p>
      </div>
      <button
        class="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title="Toggle dark mode"
        @click="toggleDark"
      >
        <span v-if="isDark">&#9728;</span>
        <span v-else>&#9790;</span>
      </button>
    </div>

    <div class="min-h-[400px]">
      <router-view />
    </div>

    <UndoToast />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import LocalModeWarning from '@/components/common/LocalModeWarning.vue'
import UndoToast from '@/components/TaskList/UndoToast.vue'

const isDark = ref(false)

function toggleDark() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('taskList_darkMode', isDark.value ? 'true' : 'false')
}

onMounted(() => {
  const stored = localStorage.getItem('taskList_darkMode')
  if (stored === 'true' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    isDark.value = true
    document.documentElement.classList.add('dark')
  }
})
</script>
