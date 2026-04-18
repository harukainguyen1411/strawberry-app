<template>
  <div
    class="day-column flex flex-col rounded-xl border bg-white dark:bg-gray-900 transition-colors"
    :class="[
      isToday ? 'border-primary-500 shadow-[0_0_0_1.5px] shadow-primary-500/30 bg-primary-50/20 dark:bg-primary-950/20' : 'border-gray-200 dark:border-gray-700',
      dragOver ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30' : ''
    ]"
    :style="columnStyle"
    :data-date="date"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 dark:border-gray-700">
      <span class="text-[0.7rem] font-semibold uppercase tracking-wider" :class="isToday ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'">
        {{ dayName }}
        <span
          v-if="activeCount > 0"
          class="ml-1.5 inline-block rounded-full px-1.5 py-px text-[0.65rem] font-semibold"
          :class="isToday ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'"
        >{{ activeCount }}</span>
      </span>
      <span
        class="text-xs font-bold"
        :class="isToday
          ? 'bg-primary-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-[0.72rem]'
          : 'text-gray-500 dark:text-gray-400'"
      >{{ dayNum }}</span>
    </div>

    <!-- Tasks -->
    <div ref="tasksContainer" class="flex-1 flex flex-col gap-1.5 p-1.5 min-h-[60px]">
      <TransitionGroup name="card">
        <TaskCard
          v-for="task in dayTasks"
          :key="task.id"
          :task="task"
          @drag-start="(id, e) => $emit('dragStart', id, e)"
          @drag-end="$emit('dragEnd')"
          @delete="id => $emit('delete', id)"
          @status-change="(id, st) => $emit('statusChange', id, st)"
          @priority-change="(id, p) => $emit('priorityChange', id, p)"
          @update="t => $emit('update', t)"
          @touch-drop="(id, date) => $emit('touchDrop', id, date)"
        />
      </TransitionGroup>
      <div v-if="dayTasks.length === 0" class="text-center text-gray-400 dark:text-gray-600 text-xs py-6 italic opacity-60">
        Nothing scheduled
      </div>
    </div>

    <!-- Add button -->
    <div
      class="text-center text-xs text-gray-400 py-1.5 cursor-pointer border-t border-gray-200 dark:border-gray-700 rounded-b-xl transition-colors hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-950/30 dark:hover:text-primary-400"
      @click="$emit('addTask', date)"
    >+ Add</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Task, TaskStatus, TaskPriority } from '@/views/TaskList/types'
import { DAY_NAMES } from '@/views/TaskList/types'
import TaskCard from './TaskCard.vue'

const props = defineProps<{
  date: string
  dayTasks: Task[]
  isToday: boolean
  isMobile?: boolean
}>()

const emit = defineEmits<{
  addTask: [date: string]
  drop: [taskId: string, date: string, insertBeforeId?: string]
  dragStart: [taskId: string, event: DragEvent]
  dragEnd: []
  delete: [taskId: string]
  statusChange: [taskId: string, status: TaskStatus]
  priorityChange: [taskId: string, priority: TaskPriority]
  update: [task: Task]
  touchDrop: [taskId: string, date: string]
}>()

const tasksContainer = ref<HTMLElement>()
const dragOver = ref(false)

const dateObj = computed(() => {
  const [y, m, d] = props.date.split('-').map(Number)
  return new Date(y, m - 1, d)
})

const dayName = computed(() => {
  const jsDay = dateObj.value.getDay()
  // Convert JS day (0=Sun) to our DAY_NAMES (0=Mon)
  const idx = jsDay === 0 ? 6 : jsDay - 1
  return DAY_NAMES[idx]
})

const dayNum = computed(() => dateObj.value.getDate())
const activeCount = computed(() => props.dayTasks.length)

const columnStyle = computed(() => {
  if (props.isMobile) return { minWidth: '220px', flexShrink: 0, scrollSnapAlign: 'start' }
  return { minHeight: '200px' }
})

function getDropTarget(y: number): string | undefined {
  if (!tasksContainer.value) return undefined
  const cards = Array.from(tasksContainer.value.querySelectorAll('.task-card'))
  for (const card of cards) {
    const rect = card.getBoundingClientRect()
    if (y < rect.top + rect.height / 2) {
      return (card as HTMLElement).dataset.id
    }
  }
  return undefined
}

function onDragOver(_e: DragEvent) {
  dragOver.value = true
}

function onDragLeave() {
  dragOver.value = false
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  const taskId = e.dataTransfer?.getData('text/plain')
  if (!taskId) return
  const insertBeforeId = getDropTarget(e.clientY)
  emit('drop', taskId, props.date, insertBeforeId)
}
</script>

<style scoped>
.card-enter-active,
.card-leave-active {
  transition: all 0.2s ease;
}
.card-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
.card-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
</style>
