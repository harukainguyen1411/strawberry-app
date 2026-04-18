<template>
  <div
    ref="cardEl"
    class="task-card group relative rounded-lg p-3 text-sm transition-all cursor-grab active:cursor-grabbing"
    :class="[
      task.status === 'done' ? 'opacity-55' : '',
      isDragging ? 'opacity-30' : '',
      bgClass
    ]"
    :data-id="task.id"
    draggable="true"
    @dragstart="onCardDragStart"
    @dragend="onDragEnd"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
  >
    <div class="flex items-start justify-between gap-1.5">
      <!-- Priority dot -->
      <span
        class="w-[7px] h-[7px] rounded-full flex-shrink-0 mt-1 cursor-pointer transition-transform hover:scale-[1.4]"
        :class="priorityDotClass"
        :title="'Priority: ' + task.priority"
        @click.stop="cyclePriority"
        @mousedown.stop
      ></span>

      <!-- Title -->
      <span
        v-if="task.tag"
        class="inline-block rounded px-1.5 py-0.5 text-xs font-semibold font-mono bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400"
        v-text="task.title"
      ></span>
      <span
        v-else
        ref="titleEl"
        class="editable flex-1 rounded px-1 py-0.5 -mx-1 -my-0.5 text-[0.78rem] font-semibold leading-snug cursor-text hover:bg-black/[0.04] focus:outline-2 focus:outline-primary-500 focus:bg-white dark:focus:bg-gray-800 transition-colors"
        :class="{ 'line-through': task.status === 'done' }"
        :contenteditable="true"
        spellcheck="false"
        v-text="task.title"
        @mousedown.stop
        @blur="onTitleBlur"
        @keydown.enter.prevent="($event.target as HTMLElement).blur()"
        @keydown.escape="onTitleEscape"
      ></span>

      <!-- Delete -->
      <button
        class="flex-shrink-0 rounded p-0.5 text-sm leading-none text-transparent group-hover:text-gray-400 hover:!text-red-500 hover:!bg-red-50 dark:hover:!bg-red-900/20 transition-colors"
        title="Delete"
        @mousedown.stop
        @click="onDelete"
      >&times;</button>
    </div>

    <!-- Description -->
    <div
      ref="descEl"
      class="editable mt-1 rounded px-1 py-0.5 -mx-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed cursor-text hover:bg-black/[0.04] focus:outline-2 focus:outline-primary-500 focus:bg-white dark:focus:bg-gray-800 transition-colors"
      :contenteditable="true"
      spellcheck="false"
      @mousedown.stop
      @blur="onDescBlur"
      @keydown.enter.prevent="($event.target as HTMLElement).blur()"
      v-text="task.description"
      @keydown.escape="onDescEscape"
    ></div>

    <!-- Notes (from Evelynn) -->
    <div
      v-if="task.notes"
      class="mt-1 px-1 text-[0.65rem] italic text-violet-500 dark:text-violet-400 leading-relaxed"
      v-text="task.notes"
    ></div>

    <!-- Footer: status + priority -->
    <div class="flex items-center justify-between mt-1.5 gap-2">
      <!-- Status badge -->
      <div class="relative" ref="statusWrapper">
        <button
          class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold cursor-pointer select-none border-none transition-all hover:brightness-[0.93] hover:scale-[1.04] active:scale-[0.96]"
          :class="statusBadgeClass"
          @mousedown.stop
          @click.stop="toggleStatusDropdown"
        >
          <span class="w-[5px] h-[5px] rounded-full flex-shrink-0" :class="statusDotClass"></span>
          <span>{{ STATUS_LABELS[task.status] }}</span>
        </button>
        <Transition name="dropdown">
          <div
            v-if="showStatusDropdown"
            class="absolute bottom-full mb-1 z-50 min-w-[120px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-1"
            :class="dropdownAlign"
          >
            <div
              v-for="st in STATUS_ORDER"
              :key="st"
              class="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap"
              :class="statusOptionClass(st)"
              @click.stop="onStatusChange(st)"
            >
              <span class="w-[5px] h-[5px] rounded-full flex-shrink-0" :class="statusOptionDotClass(st)"></span>
              {{ STATUS_LABELS[st] }}
            </div>
          </div>
        </Transition>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import type { Task, TaskStatus, TaskPriority } from '@/views/TaskList/types'
import { STATUS_ORDER, STATUS_LABELS } from '@/views/TaskList/types'

const props = defineProps<{ task: Task }>()
const emit = defineEmits<{
  dragStart: [taskId: string, event: DragEvent]
  dragEnd: []
  delete: [taskId: string]
  statusChange: [taskId: string, status: TaskStatus]
  priorityChange: [taskId: string, priority: TaskPriority]
  update: [task: Task]
  touchDrop: [taskId: string, date: string]
}>()

const cardEl = ref<HTMLElement>()
const titleEl = ref<HTMLElement>()
const descEl = ref<HTMLElement>()
const statusWrapper = ref<HTMLElement>()
const showStatusDropdown = ref(false)
const isDragging = ref(false)

const bgClass = computed(() => {
  return 'bg-gray-100 dark:bg-gray-800/60 hover:shadow-sm'
})

const statusBadgeClass = computed(() => {
  const map: Record<TaskStatus, string> = {
    todo: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    inprogress: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    onhold: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    done: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'
  }
  return map[props.task.status]
})

const statusDotClass = computed(() => {
  const map: Record<TaskStatus, string> = {
    todo: 'bg-gray-400',
    inprogress: 'bg-blue-500',
    onhold: 'bg-orange-500',
    done: 'bg-green-500'
  }
  return map[props.task.status]
})

function statusOptionClass(st: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    todo: 'text-gray-600 dark:text-gray-300',
    inprogress: 'text-blue-600 dark:text-blue-400',
    onhold: 'text-orange-600 dark:text-orange-400',
    done: 'text-green-600 dark:text-green-400'
  }
  return map[st]
}

function statusOptionDotClass(st: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    todo: 'bg-gray-400',
    inprogress: 'bg-blue-500',
    onhold: 'bg-orange-500',
    done: 'bg-green-500'
  }
  return map[st]
}

const priorityDotClass = computed(() => {
  const map: Record<TaskPriority, string> = {
    high: 'bg-red-500',
    medium: 'bg-yellow-400',
    low: 'bg-gray-300 dark:bg-gray-600'
  }
  return map[props.task.priority]
})


const dropdownAlign = computed(() => {
  if (!statusWrapper.value) return 'left-0'
  const rect = statusWrapper.value.getBoundingClientRect()
  return rect.left + 120 > window.innerWidth ? 'right-0' : 'left-0'
})

function toggleStatusDropdown() {
  showStatusDropdown.value = !showStatusDropdown.value
}

function onStatusChange(st: TaskStatus) {
  showStatusDropdown.value = false
  emit('statusChange', props.task.id, st)
}

function cyclePriority() {
  const order: TaskPriority[] = ['low', 'medium', 'high']
  const idx = order.indexOf(props.task.priority)
  const next = order[(idx + 1) % order.length]
  emit('priorityChange', props.task.id, next)
}

function onTitleBlur(e: FocusEvent) {
  const el = e.target as HTMLElement
  const newTitle = el.textContent?.trim() || ''
  if (newTitle !== props.task.title) {
    emit('update', { ...props.task, title: newTitle })
  }
}

function onTitleEscape(e: KeyboardEvent) {
  const el = e.target as HTMLElement
  el.textContent = props.task.title
  el.blur()
}

function onDescBlur(e: FocusEvent) {
  const el = e.target as HTMLElement
  const newDesc = el.textContent?.trim() || ''
  if (newDesc !== props.task.description) {
    emit('update', { ...props.task, description: newDesc })
  }
}

function onDescEscape(e: KeyboardEvent) {
  const el = e.target as HTMLElement
  el.textContent = props.task.description
  el.blur()
}

function onDelete() {
  emit('delete', props.task.id)
}

// Desktop drag
function onCardDragStart(e: DragEvent) {
  isDragging.value = true
  e.dataTransfer?.setData('text/plain', props.task.id)
  emit('dragStart', props.task.id, e)
}

function onDragEnd() {
  isDragging.value = false
  emit('dragEnd')
}

// Touch drag with 15px horizontal threshold
let touchStartX = 0
let touchClone: HTMLElement | null = null

function onTouchStart(e: TouchEvent) {
  touchStartX = e.touches[0].clientX
}

function onTouchMove(e: TouchEvent) {
  const tx = e.touches[0].clientX
  const ty = e.touches[0].clientY
  const dx = Math.abs(tx - touchStartX)

  if (!touchClone && dx > 15) {
    e.preventDefault()
    isDragging.value = true
    touchClone = cardEl.value!.cloneNode(true) as HTMLElement
    touchClone.style.position = 'fixed'
    touchClone.style.width = cardEl.value!.offsetWidth + 'px'
    touchClone.style.opacity = '0.8'
    touchClone.style.pointerEvents = 'none'
    touchClone.style.zIndex = '1000'
    touchClone.style.transform = 'rotate(2deg)'
    document.body.appendChild(touchClone)
  }

  if (touchClone) {
    e.preventDefault()
    touchClone.style.left = (tx - touchClone.offsetWidth / 2) + 'px'
    touchClone.style.top = (ty - 20) + 'px'
    document.querySelectorAll('.day-column').forEach(col => {
      const r = col.getBoundingClientRect()
      col.classList.toggle('drag-over', tx >= r.left && tx <= r.right && ty >= r.top && ty <= r.bottom)
    })
  }
}

function onTouchEnd(e: TouchEvent) {
  isDragging.value = false
  if (touchClone) {
    touchClone.remove()
    touchClone = null
    const tx = e.changedTouches[0].clientX
    const ty = e.changedTouches[0].clientY
    document.querySelectorAll('.day-column').forEach(col => {
      col.classList.remove('drag-over')
      const r = col.getBoundingClientRect()
      if (tx >= r.left && tx <= r.right && ty >= r.top && ty <= r.bottom) {
        const date = (col as HTMLElement).dataset.date
        if (date) {
          emit('touchDrop', props.task.id, date)
        }
      }
    })
  }
}

// Close dropdown on outside click
function onOutsideClick(e: MouseEvent) {
  if (showStatusDropdown.value && statusWrapper.value && !statusWrapper.value.contains(e.target as Node)) {
    showStatusDropdown.value = false
  }
}

onMounted(() => document.addEventListener('click', onOutsideClick))
onBeforeUnmount(() => document.removeEventListener('click', onOutsideClick))
</script>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.12s, transform 0.12s;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
