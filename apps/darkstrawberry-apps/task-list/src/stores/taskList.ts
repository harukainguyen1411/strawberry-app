import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'
import { db } from '@/firebase/config'
import {
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
  writeBatch
} from 'firebase/firestore'
import { appCollection, appDoc } from '@shared/firebase/appFirestore'

const TASK_LIST_APP_ID = 'task-list'
import type { Task, TaskStatus, TaskPriority } from '@/views/TaskList/types'

const LOCAL_STORAGE_KEY = 'taskList_tasks'

interface UndoEntry {
  type: 'delete' | 'status'
  task: Task
  previousStatus?: TaskStatus
  timer: ReturnType<typeof setTimeout>
}

export const useTaskListStore = defineStore('taskList', () => {
  const authStore = useAuthStore()

  const tasks = ref<Task[]>([])
  const loading = ref(false)
  const undoStack = ref<UndoEntry[]>([])

  const userId = computed(() => authStore.user?.uid ?? null)
  const isLocal = computed(() => authStore.localMode)

  function getCollection() {
    if (!userId.value) throw new Error('Not authenticated')
    return appCollection(db, TASK_LIST_APP_ID, userId.value, 'tasks')
  }

  // ── Date helpers ──
  function toDateStr(d: Date): string {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0')
  }

  function todayStr(): string {
    return toDateStr(new Date())
  }

  // ── Carry forward: move overdue todo/inprogress tasks to today ──
  function carryForward(): Task[] {
    const today = todayStr()
    const movedTasks: Task[] = []
    tasks.value.forEach(t => {
      if ((t.status === 'todo' || t.status === 'inprogress') && t.date < today) {
        t.date = today
        movedTasks.push(t)
      }
    })
    return movedTasks
  }

  // ── Local storage ──
  function saveLocal() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks.value))
  }

  function loadLocal() {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (raw) {
      try {
        tasks.value = JSON.parse(raw)
      } catch {
        tasks.value = []
      }
    }
  }

  // ── Firestore ──
  async function loadFromFirestore() {
    loading.value = true
    try {
      const q = query(getCollection(), orderBy('createdAt', 'desc'))
      const snapshot = await getDocs(q)
      tasks.value = snapshot.docs
        .filter(d => !d.data()._deleted)
        .map(d => {
          const data = d.data()
          return {
            id: d.id,
            title: data.title ?? '',
            description: data.description ?? '',
            status: data.status ?? 'todo',
            priority: data.priority ?? 'medium',
            date: data.date ?? todayStr(),
            tag: data.tag ?? false,
            createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? undefined,
            updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? undefined,
            updatedBy: data.updatedBy ?? undefined,
            source: data.source ?? undefined,
            notes: data.notes ?? undefined,
            category: data.category ?? undefined
          } as Task
        })
    } finally {
      loading.value = false
    }
  }

  async function saveTaskToFirestore(task: Task) {
    const taskRef = appDoc(db, TASK_LIST_APP_ID, userId.value!, 'tasks', task.id)
    await updateDoc(taskRef, {
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      date: task.date,
      tag: task.tag,
      _deleted: task._deleted ?? false,
      updatedAt: Timestamp.now(),
      updatedBy: 'duong'
    })
  }

  // ── Public API ──

  async function load() {
    if (isLocal.value) {
      loadLocal()
    } else {
      await loadFromFirestore()
    }
    const movedTasks = carryForward()
    if (movedTasks.length > 0) {
      await saveTasks(movedTasks)
    }
  }

  async function saveTasks(changedTasks: Task[]) {
    if (isLocal.value) {
      saveLocal()
      return
    }
    const batch = writeBatch(db)
    for (const task of changedTasks) {
      const taskRef = appDoc(db, TASK_LIST_APP_ID, userId.value!, 'tasks', task.id)
      batch.update(taskRef, { date: task.date, updatedAt: Timestamp.now(), updatedBy: 'duong' })
    }
    await batch.commit()
  }

  async function addTask(date: string): Promise<Task> {
    const now = new Date().toISOString()
    const newTask: Task = {
      id: 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      title: 'New task',
      description: '',
      status: 'todo',
      priority: 'medium',
      date,
      tag: false,
      createdAt: now,
      updatedAt: now
    }

    if (isLocal.value) {
      tasks.value.push(newTask)
      saveLocal()
    } else {
      const docRef = await addDoc(getCollection(), {
        title: newTask.title,
        description: newTask.description,
        status: newTask.status,
        priority: newTask.priority,
        date: newTask.date,
        tag: newTask.tag,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        updatedBy: 'duong',
        source: 'app'
      })
      newTask.id = docRef.id
      tasks.value.push(newTask)
    }

    return newTask
  }

  async function updateTask(task: Task) {
    task.updatedAt = new Date().toISOString()
    if (isLocal.value) {
      saveLocal()
    } else {
      await saveTaskToFirestore(task)
    }
  }

  async function deleteTask(taskId: string, withUndo = true) {
    const idx = tasks.value.findIndex(t => t.id === taskId)
    if (idx === -1) return

    const task = tasks.value[idx]

    if (withUndo) {
      // Soft-delete: hide from UI, keep in Firestore until undo window expires
      task._deleted = true
      if (isLocal.value) {
        saveLocal()
      } else {
        await saveTaskToFirestore(task)
      }

      pushUndo({
        type: 'delete',
        task: { ...task },
        timer: setTimeout(() => commitDelete(taskId), 5000)
      })
    } else {
      // Hard delete (called after undo window or explicitly)
      tasks.value.splice(idx, 1)
      if (isLocal.value) {
        saveLocal()
      } else {
        await deleteDoc(appDoc(db, TASK_LIST_APP_ID, userId.value!, 'tasks', taskId))
      }
    }
  }

  async function commitDelete(taskId: string) {
    removeUndo('delete', taskId)
    const idx = tasks.value.findIndex(t => t.id === taskId)
    if (idx === -1) return
    tasks.value.splice(idx, 1)
    if (isLocal.value) {
      saveLocal()
    } else {
      await deleteDoc(appDoc(db, TASK_LIST_APP_ID, userId.value!, 'tasks', taskId))
    }
  }

  async function changeStatus(taskId: string, newStatus: TaskStatus) {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return

    const previousStatus = task.status
    task.status = newStatus
    await updateTask(task)

    pushUndo({
      type: 'status',
      task: { ...task },
      previousStatus,
      timer: setTimeout(() => removeUndo('status', task.id), 5000)
    })
  }

  async function changePriority(taskId: string, newPriority: TaskPriority) {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return
    task.priority = newPriority
    await updateTask(task)
  }

  async function moveTask(taskId: string, newDate: string, insertBeforeId?: string) {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return

    task.date = newDate

    // Reorder in array
    const filtered = tasks.value.filter(t => t.id !== taskId)
    if (insertBeforeId) {
      const targetIdx = filtered.findIndex(t => t.id === insertBeforeId)
      if (targetIdx !== -1) {
        filtered.splice(targetIdx, 0, task)
      } else {
        filtered.push(task)
      }
    } else {
      filtered.push(task)
    }
    tasks.value = filtered

    await updateTask(task)
  }

  // ── Undo system ──
  function pushUndo(entry: UndoEntry) {
    // Only keep latest per task
    const existing = undoStack.value.findIndex(u => u.task.id === entry.task.id)
    if (existing !== -1) {
      clearTimeout(undoStack.value[existing].timer)
      undoStack.value.splice(existing, 1)
    }
    undoStack.value.push(entry)
  }

  function removeUndo(type: string, taskId: string) {
    const idx = undoStack.value.findIndex(u => u.type === type && u.task.id === taskId)
    if (idx !== -1) undoStack.value.splice(idx, 1)
  }

  async function undo(entry: UndoEntry) {
    clearTimeout(entry.timer)
    const idx = undoStack.value.indexOf(entry)
    if (idx !== -1) undoStack.value.splice(idx, 1)

    if (entry.type === 'delete') {
      // Restore soft-deleted task
      const task = tasks.value.find(t => t.id === entry.task.id)
      if (task) {
        delete task._deleted
        if (isLocal.value) {
          saveLocal()
        } else {
          await saveTaskToFirestore(task)
        }
      }
    } else if (entry.type === 'status' && entry.previousStatus) {
      const task = tasks.value.find(t => t.id === entry.task.id)
      if (task) {
        task.status = entry.previousStatus
        await updateTask(task)
      }
    }
  }

  // ── Queries ──
  function tasksForDate(date: string): Task[] {
    return tasks.value
      .filter(t => !t._deleted && t.date === date && t.status !== 'onhold')
      .sort((a, b) => {
        const order: Record<string, number> = { inprogress: 0, todo: 1, done: 2 }
        return (order[a.status] ?? 1) - (order[b.status] ?? 1)
      })
  }

  const onHoldTasks = computed(() => tasks.value.filter(t => !t._deleted && t.status === 'onhold'))

  return {
    tasks,
    loading,
    undoStack,
    load,
    addTask,
    updateTask,
    deleteTask,
    changeStatus,
    changePriority,
    moveTask,
    undo,
    tasksForDate,
    onHoldTasks,
    todayStr
  }
})
