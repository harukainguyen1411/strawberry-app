export type TaskStatus = 'todo' | 'inprogress' | 'onhold' | 'done'
export type TaskPriority = 'high' | 'medium' | 'low'

export type TaskUpdatedBy = 'duong' | 'evelynn'
export type TaskSource = 'app' | 'evelynn'

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  date: string // YYYY-MM-DD
  tag: boolean
  createdAt?: string
  updatedAt?: string
  _deleted?: boolean
  updatedBy?: TaskUpdatedBy
  source?: TaskSource
  notes?: string
  category?: string
}

export const STATUS_ORDER: TaskStatus[] = ['todo', 'inprogress', 'onhold', 'done']

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  inprogress: 'In Progress',
  onhold: 'On Hold',
  done: 'Done'
}

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low'
}

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
