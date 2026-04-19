<template>
  <Teleport to="body">
    <TransitionGroup name="toast" tag="div" class="fixed bottom-6 right-6 z-[200] flex flex-col gap-2">
      <div
        v-for="entry in store.undoStack"
        :key="entry.task.id + entry.type"
        class="flex items-center gap-3 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2.5 shadow-lg text-sm"
      >
        <span v-if="entry.type === 'delete'">Deleted "{{ entry.task.title }}"</span>
        <span v-else>Changed to {{ STATUS_LABELS[entry.task.status] }}</span>
        <button
          class="font-semibold text-primary-400 dark:text-primary-600 hover:underline"
          @click="store.undo(entry)"
        >Undo</button>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup lang="ts">
import { useTaskListStore } from '@/stores/taskList'
import { STATUS_LABELS } from '@/views/TaskList/types'

const store = useTaskListStore()
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(16px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(32px);
}
</style>
