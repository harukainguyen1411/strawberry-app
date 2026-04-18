<template>
  <div>
    <div v-if="store.loading" class="flex items-center justify-center py-16">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>
    <WeekGrid v-else />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useTaskListStore } from '@/stores/taskList'
import WeekGrid from '@/components/TaskList/WeekGrid.vue'

const store = useTaskListStore()

onMounted(() => {
  store.load()
})
</script>
