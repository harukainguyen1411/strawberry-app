<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <div class="bg-white rounded-lg shadow p-4 sm:p-6">
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
        <div>
          <h2 class="text-xl sm:text-2xl font-semibold text-gray-900">{{ $t('goals.title') }}</h2>
          <p class="text-xs sm:text-sm text-gray-600 mt-1">{{ $t('goals.subtitle') }}</p>
        </div>
        <button
          @click="showForm = true"
          class="bg-primary-600 text-white px-4 py-2.5 sm:py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base touch-manipulation"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>{{ $t('goals.addGoal') }}</span>
        </button>
      </div>
    </div>

    <!-- Goal Form Modal -->
    <GoalForm
      v-if="showForm"
      :goal="editingGoal"
      @close="handleFormClose"
      @save="handleSaveGoal"
    />

    <!-- Active Goals -->
    <div class="bg-white rounded-lg shadow">
      <div class="p-4 sm:p-6 border-b border-gray-200">
        <h3 class="text-base sm:text-lg font-semibold text-gray-900">{{ $t('goals.activeGoals') }}</h3>
      </div>

      <!-- Error State -->
      <div v-if="goalsStore.error && !goalsStore.loading" class="p-4 sm:p-6 bg-red-50 border border-red-200 rounded-lg mx-4 sm:mx-6 my-4">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div class="flex-1">
            <p class="text-sm font-medium text-red-800">{{ $t('goals.errorLoading') }}</p>
            <p class="text-xs sm:text-sm text-red-600 mt-1">{{ goalsStore.error }}</p>
            <button
              @click="goalsStore.fetchGoals()"
              class="mt-2 text-xs sm:text-sm text-red-700 underline hover:text-red-800"
            >
              {{ $t('common.tryAgain') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="goalsStore.loading" class="p-8 sm:p-12 text-center">
        <div class="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p class="text-sm sm:text-base text-gray-600">{{ $t('goals.loadingGoals') }}</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="activeGoals.length === 0" class="p-8 sm:p-12 text-center">
        <div class="text-5xl sm:text-6xl mb-4">🎯</div>
        <p class="text-gray-600 text-base sm:text-lg mb-2">{{ $t('goals.noActiveGoals') }}</p>
        <p class="text-gray-500 text-sm mb-4">{{ $t('goals.noActiveGoalsDesc') }}</p>
        <button
          @click="showForm = true"
          class="bg-primary-600 text-white px-4 py-2.5 sm:py-2 rounded-lg hover:bg-primary-700 transition-colors touch-manipulation"
        >
          {{ $t('goals.createFirstGoal') }}
        </button>
      </div>

      <!-- Goals List -->
      <div v-else class="divide-y divide-gray-200">
        <div
          v-for="goal in activeGoals"
          :key="goal.id"
          class="p-4 sm:p-6"
        >
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0 mb-3 sm:mb-4">
            <div class="flex-1 min-w-0">
              <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                <h4 class="text-base sm:text-lg font-semibold text-gray-900">
                  {{ formatGoalType(goal.type) }} {{ $t('goals.goal') }}
                </h4>
                <span
                  :class="[
                    'px-2 py-1 text-xs font-medium rounded inline-block w-fit',
                    getStatusClass(goal)
                  ]"
                >
                  {{ getGoalStatus(goal) }}
                </span>
              </div>
              <p class="text-xs sm:text-sm text-gray-600">
                Target: {{ formatDuration(goal.targetMinutes) }} per {{ goal.type === 'daily' ? 'day' : goal.type === 'weekly' ? 'week' : goal.type === 'monthly' ? 'month' : 'year' }}
              </p>
            </div>
            <div class="flex gap-2 flex-shrink-0">
              <button
                @click="editGoal(goal)"
                class="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors touch-manipulation"
                title="Edit goal"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                @click="deleteGoal(goal.id!)"
                class="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors touch-manipulation"
                title="Delete goal"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Progress Bar -->
          <div class="mb-2">
            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0 mb-1">
              <span class="text-xs sm:text-sm text-gray-600">{{ $t('goals.progress') }}</span>
              <span class="text-xs sm:text-sm font-semibold text-gray-900">
                {{ formatDuration(goalProgress(goal).current) }} / {{ formatDuration(goal.targetMinutes) }}
                ({{ Math.round(goalProgress(goal).percentage) }}%)
              </span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2 sm:h-3">
              <div
                :class="[
                  'h-2 sm:h-3 rounded-full transition-all',
                  goalProgress(goal).percentage >= 100 ? 'bg-green-500' : 'bg-primary-600'
                ]"
                :style="{ width: `${Math.min(goalProgress(goal).percentage, 100)}%` }"
              ></div>
            </div>
          </div>

          <!-- Remaining Time -->
          <p class="text-xs text-gray-500">
            {{ goalProgress(goal).remaining > 0 
              ? `${formatDuration(goalProgress(goal).remaining)} ${t('goals.remaining')}` 
              : goalProgress(goal).percentage >= 100 
                ? t('goals.goalCompleted') 
                : t('goals.goalExceeded') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGoalsStore } from '@/stores/goals'
import { useReadingSessionsStore } from '@/stores/readingSessions'
import GoalForm from '@/components/ReadTracker/GoalForm.vue'
import type { Goal } from '@/firebase/firestore'
import {
  isToday,
  isThisWeek,
  isThisMonth,
  isThisYear,
  getWeek,
  getYear
} from 'date-fns'

const { t } = useI18n()

const goalsStore = useGoalsStore()
const sessionsStore = useReadingSessionsStore()

const showForm = ref(false)
const editingGoal = ref<Goal | null>(null)

// Fetch data on mount
onMounted(async () => {
  await goalsStore.fetchGoals()
  await sessionsStore.fetchSessions()
})

// Get active goals (current period)
const activeGoals = computed(() => {
  const now = new Date()
  const currentYear = getYear(now)
  const currentMonth = now.getMonth() + 1
  const currentWeek = getWeek(now)

  return goalsStore.goals.filter(goal => {
    if (goal.type === 'daily') {
      // Daily goals are always active
      return true
    } else if (goal.type === 'weekly') {
      return goal.year === currentYear && goal.week === currentWeek
    } else if (goal.type === 'monthly') {
      return goal.year === currentYear && goal.month === currentMonth
    } else if (goal.type === 'yearly') {
      return goal.year === currentYear
    }
    return false
  })
})

// Calculate goal progress
const goalProgress = (goal: Goal) => {
  let currentMinutes = 0

  if (goal.type === 'daily') {
    currentMinutes = sessionsStore.sessions
      .filter(session => session.date && isToday(session.date.toDate()))
      .reduce((total, session) => total + (session.duration || 0), 0)
  } else if (goal.type === 'weekly') {
    currentMinutes = sessionsStore.sessions
      .filter(session => session.date && isThisWeek(session.date.toDate()))
      .reduce((total, session) => total + (session.duration || 0), 0)
  } else if (goal.type === 'monthly') {
    currentMinutes = sessionsStore.sessions
      .filter(session => session.date && isThisMonth(session.date.toDate()))
      .reduce((total, session) => total + (session.duration || 0), 0)
  } else if (goal.type === 'yearly') {
    currentMinutes = sessionsStore.sessions
      .filter(session => session.date && isThisYear(session.date.toDate()))
      .reduce((total, session) => total + (session.duration || 0), 0)
  }

  const percentage = (currentMinutes / goal.targetMinutes) * 100
  const remaining = Math.max(0, goal.targetMinutes - currentMinutes)

  return {
    current: currentMinutes,
    target: goal.targetMinutes,
    percentage,
    remaining
  }
}

const getGoalStatus = (goal: Goal): string => {
  const progress = goalProgress(goal)
  if (progress.percentage >= 100) {
    return t('goals.status.completed')
  } else if (progress.percentage >= 75) {
    return t('goals.status.almostThere')
  } else if (progress.percentage >= 50) {
    return t('goals.status.onTrack')
  } else {
    return t('goals.status.inProgress')
  }
}

const getStatusClass = (goal: Goal): string => {
  const progress = goalProgress(goal)
  if (progress.percentage >= 100) {
    return 'bg-green-100 text-green-800'
  } else if (progress.percentage >= 75) {
    return 'bg-blue-100 text-blue-800'
  } else if (progress.percentage >= 50) {
    return 'bg-yellow-100 text-yellow-800'
  } else {
    return 'bg-gray-100 text-gray-800'
  }
}

const editGoal = (goal: Goal) => {
  editingGoal.value = { ...goal }
  showForm.value = true
}

const handleFormClose = () => {
  showForm.value = false
  editingGoal.value = null
}

const handleSaveGoal = async () => {
  showForm.value = false
  editingGoal.value = null
  await goalsStore.fetchGoals()
}

const deleteGoal = async (goalId: string) => {
  if (confirm(t('goals.deleteConfirm'))) {
    try {
      await goalsStore.removeGoal(goalId)
    } catch (error) {
      console.error('Error deleting goal:', error)
      alert(t('goals.deleteError'))
    }
  }
}

const formatGoalType = (type: string): string => {
  const typeMap: Record<string, string> = {
    daily: t('goals.types.daily'),
    weekly: t('goals.types.weekly'),
    monthly: t('goals.types.monthly'),
    yearly: t('goals.types.yearly')
  }
  return typeMap[type] || type
}

const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}
</script>
