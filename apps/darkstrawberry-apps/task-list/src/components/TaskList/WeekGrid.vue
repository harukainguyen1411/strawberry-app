<template>
  <div>
    <!-- Week navigation -->
    <div class="flex items-center gap-2 mb-5">
      <button class="px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" @click="prevWeek">&larr;</button>
      <span class="text-sm font-semibold text-gray-500 dark:text-gray-400 min-w-[160px] text-center">{{ weekLabel }}</span>
      <button class="px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" @click="nextWeek">&rarr;</button>
      <button class="ml-1 px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" @click="goToday">Today</button>
    </div>

    <!-- Grid -->
    <div
      class="grid gap-2.5 mb-5"
      :class="isTablet ? 'flex overflow-x-auto snap-x snap-mandatory pb-2 -mx-3 px-3' : 'grid-cols-7'"
    >
      <DayColumn
        v-for="date in weekDates"
        :key="date"
        :date="date"
        :day-tasks="store.tasksForDate(date)"
        :is-today="date === today"
        :is-mobile="isTablet"
        :style="isTablet && date === today ? { order: -1 } : {}"
        @add-task="d => store.addTask(d)"
        @drop="onDrop"
        @drag-start="onDragStart"
        @drag-end="onDragEnd"
        @delete="id => store.deleteTask(id)"
        @status-change="(id, st) => store.changeStatus(id, st)"
        @priority-change="(id, p) => store.changePriority(id, p)"
        @update="t => store.updateTask(t)"
        @touch-drop="onTouchDrop"
      />
    </div>

    <!-- On Hold section -->
    <div v-if="store.onHoldTasks.length > 0" class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 mb-5">
      <div class="text-xs font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400 mb-2 flex items-center gap-1.5">
        <span class="w-[7px] h-[7px] rounded-full bg-orange-500"></span> On Hold
      </div>
      <div class="flex flex-wrap gap-2" :class="{ 'flex-col': isMobile }">
        <div v-for="task in store.onHoldTasks" :key="task.id" :class="isMobile ? 'w-full' : 'w-60'" class="flex-shrink-0">
          <TaskCard
            :task="task"
            @delete="id => store.deleteTask(id)"
            @status-change="(id, st) => store.changeStatus(id, st)"
            @priority-change="(id, p) => store.changePriority(id, p)"
            @update="t => store.updateTask(t)"
          />
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useTaskListStore } from '@/stores/taskList'
import DayColumn from './DayColumn.vue'
import TaskCard from './TaskCard.vue'

const store = useTaskListStore()

const currentMonday = ref(getMonday(new Date()))
const isMobile = ref(false)
const isTablet = ref(false)

function checkMobile() {
  isMobile.value = window.innerWidth < 768
  isTablet.value = window.innerWidth <= 1024
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkMobile)
})

function getMonday(d: Date): Date {
  const dt = new Date(d)
  const day = dt.getDay()
  const diff = day === 0 ? -6 : 1 - day
  dt.setDate(dt.getDate() + diff)
  dt.setHours(0, 0, 0, 0)
  return dt
}

function toDateStr(d: Date): string {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}

const today = computed(() => toDateStr(new Date()))

const weekDates = computed(() => {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentMonday.value)
    d.setDate(d.getDate() + i)
    return toDateStr(d)
  })
})

const weekLabel = computed(() => {
  const mon = currentMonday.value
  const sun = new Date(mon)
  sun.setDate(sun.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return mon.toLocaleDateString('en-GB', opts) + ' — ' + sun.toLocaleDateString('en-GB', opts) + ', ' + sun.getFullYear()
})

function prevWeek() {
  const d = new Date(currentMonday.value)
  d.setDate(d.getDate() - 7)
  currentMonday.value = d
}

function nextWeek() {
  const d = new Date(currentMonday.value)
  d.setDate(d.getDate() + 7)
  currentMonday.value = d
}

function goToday() {
  currentMonday.value = getMonday(new Date())
}

// Drag handling
function onDragStart(_taskId: string, _e: DragEvent) {
  // handled by TaskCard
}

function onDragEnd() {
  // cleanup
}

function onDrop(taskId: string, date: string, insertBeforeId?: string) {
  store.moveTask(taskId, date, insertBeforeId)
}

// Touch drop — card handles the drag visuals, we just move the task
function onTouchDrop(taskId: string, date: string) {
  store.moveTask(taskId, date)
}
</script>
