<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Overview Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
      <!-- Today's Reading -->
      <div class="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
        <div class="flex items-center justify-between mb-1 sm:mb-2">
          <h3 class="text-xs sm:text-sm font-medium text-gray-600">{{ $t('dashboard.today') }}</h3>
          <span class="text-xl sm:text-2xl">📖</span>
        </div>
        <p class="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{{ formatDuration(todayTotal) }}</p>
        <p class="text-xs text-gray-500 mt-1">{{ todaySessions }} {{ todaySessions !== 1 ? $t('dashboard.sessions') : $t('dashboard.session') }}</p>
      </div>

      <!-- This Week -->
      <div class="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
        <div class="flex items-center justify-between mb-1 sm:mb-2">
          <h3 class="text-xs sm:text-sm font-medium text-gray-600">{{ $t('dashboard.week') }}</h3>
          <span class="text-xl sm:text-2xl">📅</span>
        </div>
        <p class="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{{ formatDuration(weekTotal) }}</p>
        <p class="text-xs text-gray-500 mt-1">{{ weekSessions }} {{ weekSessions !== 1 ? $t('dashboard.sessions') : $t('dashboard.session') }}</p>
      </div>

      <!-- This Month -->
      <div class="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
        <div class="flex items-center justify-between mb-1 sm:mb-2">
          <h3 class="text-xs sm:text-sm font-medium text-gray-600">{{ $t('dashboard.month') }}</h3>
          <span class="text-xl sm:text-2xl">📆</span>
        </div>
        <p class="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{{ formatDuration(monthTotal) }}</p>
        <p class="text-xs text-gray-500 mt-1">{{ monthSessions }} {{ monthSessions !== 1 ? $t('dashboard.sessions') : $t('dashboard.session') }}</p>
      </div>

      <!-- Reading Streak -->
      <div class="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
        <div class="flex items-center justify-between mb-1 sm:mb-2">
          <h3 class="text-xs sm:text-sm font-medium text-gray-600">{{ $t('dashboard.streak') }}</h3>
          <span class="text-xl sm:text-2xl">🔥</span>
        </div>
        <p class="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{{ readingStreak }}</p>
        <p class="text-xs text-gray-500 mt-1">{{ readingStreak }} {{ readingStreak !== 1 ? $t('dashboard.daysPlural') : $t('dashboard.days') }}</p>
      </div>
    </div>

    <!-- Stats Row -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      <!-- Average Reading Time -->
      <div class="bg-white rounded-lg shadow p-4 sm:p-6">
        <div class="flex items-center justify-between mb-3 sm:mb-4">
          <h3 class="text-base sm:text-lg font-semibold text-gray-900">{{ $t('dashboard.averageReadingTime') }}</h3>
          <span v-if="dailyGoalTarget" class="text-xs sm:text-sm text-gray-500">
            {{ $t('dashboard.goalTarget', { goal: formatDuration(dailyGoalTarget) }) }}
          </span>
          <span v-else class="text-xs sm:text-sm text-gray-400 italic">
            {{ $t('dashboard.noGoalSet') }}
          </span>
        </div>
        <div class="space-y-3 sm:space-y-4">
          <div>
            <div class="flex justify-between items-center mb-1">
              <span class="text-xs sm:text-sm text-gray-600">{{ $t('dashboard.dailyWeek') }}</span>
              <span class="text-base sm:text-lg font-semibold text-gray-900">
                {{ formatDuration(weekDailyAverage) }}
                <span v-if="dailyGoalTarget" class="text-xs sm:text-sm font-normal text-gray-400"> / {{ formatDuration(dailyGoalTarget) }}</span>
              </span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div
                :class="[
                  'h-2 rounded-full transition-all',
                  !dailyGoalTarget ? 'bg-primary-600' : weekDailyAverage >= dailyGoalTarget ? 'bg-green-500' : 'bg-primary-600'
                ]"
                :style="{ width: dailyGoalTarget ? `${Math.min((weekDailyAverage / dailyGoalTarget) * 100, 100)}%` : '100%' }"
              ></div>
            </div>
          </div>
          <div>
            <div class="flex justify-between items-center mb-1">
              <span class="text-xs sm:text-sm text-gray-600">{{ $t('dashboard.dailyMonth') }}</span>
              <span class="text-base sm:text-lg font-semibold text-gray-900">
                {{ formatDuration(monthDailyAverage) }}
                <span v-if="dailyGoalTarget" class="text-xs sm:text-sm font-normal text-gray-400"> / {{ formatDuration(dailyGoalTarget) }}</span>
              </span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div
                :class="[
                  'h-2 rounded-full transition-all',
                  !dailyGoalTarget ? 'bg-primary-600' : monthDailyAverage >= dailyGoalTarget ? 'bg-green-500' : 'bg-primary-600'
                ]"
                :style="{ width: dailyGoalTarget ? `${Math.min((monthDailyAverage / dailyGoalTarget) * 100, 100)}%` : '100%' }"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Books Stats -->
      <div class="bg-white rounded-lg shadow p-4 sm:p-6">
        <h3 class="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">{{ $t('dashboard.books') }}</h3>
        <div class="space-y-3 sm:space-y-4">
          <div class="flex justify-between items-center">
            <span class="text-sm sm:text-base text-gray-600">{{ $t('dashboard.reading') }}</span>
            <span class="text-xl sm:text-2xl font-bold text-blue-600">{{ readingBooksCount }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm sm:text-base text-gray-600">{{ $t('dashboard.completed') }}</span>
            <span class="text-xl sm:text-2xl font-bold text-green-600">{{ completedBooksCount }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm sm:text-base text-gray-600">{{ $t('dashboard.wantToRead') }}</span>
            <span class="text-xl sm:text-2xl font-bold text-gray-600">{{ wantToReadBooksCount }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Goals Section -->
    <div v-if="activeGoals.length > 0" class="bg-white rounded-lg shadow p-4 sm:p-6">
      <h3 class="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">{{ $t('dashboard.activeGoals') }}</h3>
      <div class="space-y-3 sm:space-y-4">
        <div
          v-for="goal in activeGoals"
          :key="goal.id"
          class="p-3 sm:p-4 bg-gray-50 rounded-lg"
        >
          <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
            <span class="text-sm sm:text-base font-medium text-gray-900">{{ formatGoalType(goal.type) }} {{ $t('dashboard.goal') }}</span>
            <span class="text-xs sm:text-sm font-semibold text-gray-700">
              {{ formatDuration(goalProgress(goal).current) }} / {{ formatDuration(goal.targetMinutes) }}
            </span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2 mb-1">
            <div
              :class="[
                'h-2 rounded-full transition-all',
                goalProgress(goal).percentage >= 100 ? 'bg-green-500' : 'bg-primary-600'
              ]"
              :style="{ width: `${Math.min(goalProgress(goal).percentage, 100)}%` }"
            ></div>
          </div>
          <p class="text-xs text-gray-500">
            {{ Math.round(goalProgress(goal).percentage) }}% {{ $t('dashboard.complete') }}
            <span v-if="goalProgress(goal).percentage >= 100"> 🎉</span>
          </p>
        </div>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      <!-- Weekly Reading Chart -->
      <div class="bg-white rounded-lg shadow p-4 sm:p-6">
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-0 mb-3 sm:mb-4">
          <h3 class="text-base sm:text-lg font-semibold text-gray-900">{{ $t('dashboard.readingTrends') }}</h3>
          <select
            v-model="chartPeriod"
            @change="updateCharts"
            :key="locale"
            class="text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-full sm:w-auto"
          >
            <option value="week">{{ $t('dashboard.thisWeek') }}</option>
            <option value="month">{{ $t('dashboard.thisMonth') }}</option>
            <option value="year">{{ $t('dashboard.thisYear') }}</option>
          </select>
        </div>
        <ReadingChart :data="chartData" :period="chartPeriod" />
      </div>

      <!-- Daily Breakdown -->
      <div class="bg-white rounded-lg shadow p-4 sm:p-6">
        <h3 class="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">{{ $t('dashboard.dailyBreakdown') }}</h3>
        <DailyBreakdownChart :sessions="sessionsStore.sessions" :period="chartPeriod" />
      </div>
    </div>

    <!-- Yearly Total -->
    <div class="bg-white rounded-lg shadow p-4 sm:p-6">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-base sm:text-lg font-semibold text-gray-900 mb-1">{{ $t('dashboard.yearlyTotal') }}</h3>
          <p class="text-2xl sm:text-3xl font-bold text-primary-600">{{ formatDuration(yearTotal) }}</p>
          <p class="text-xs sm:text-sm text-gray-500 mt-1">{{ yearSessions }} {{ $t('dashboard.totalSessions') }}</p>
        </div>
        <div class="text-4xl sm:text-6xl hidden sm:block">📚</div>
      </div>
    </div>

    <!-- Add Session Prompt -->
    <AddSessionPrompt
      v-if="showPrompt"
      @confirm="handlePromptConfirm"
      @cancel="handlePromptCancel"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useReadingSessionsStore } from '@/stores/readingSessions'
import { useBooksStore } from '@/stores/books'
import { useGoalsStore } from '@/stores/goals'
import ReadingChart from '@/components/ReadTracker/ReadingChart.vue'
import DailyBreakdownChart from '@/components/ReadTracker/DailyBreakdownChart.vue'
import AddSessionPrompt from '@/components/ReadTracker/AddSessionPrompt.vue'
import {
  isToday,
  isThisWeek,
  isThisMonth,
  isThisYear,
  startOfWeek,
  startOfMonth,
  startOfYear,
  eachDayOfInterval,
  format as formatDate,
  getWeek,
  getYear
} from 'date-fns'
import type { ReadingSession, Goal } from '@/firebase/firestore'
import { Timestamp } from 'firebase/firestore'

const { t, locale } = useI18n()

const sessionsStore = useReadingSessionsStore()
const booksStore = useBooksStore()
const goalsStore = useGoalsStore()

const chartPeriod = ref<'week' | 'month' | 'year'>('week')
const showPrompt = ref(false)

// Check if there's a session for today
const hasSessionToday = computed(() => {
  return sessionsStore.sessions.some(session => 
    session.date && isToday(session.date.toDate())
  )
})

// Check if prompt was already shown today (stored in localStorage)
const getPromptShownKey = (): string => {
  const today = formatDate(new Date(), 'yyyy-MM-dd')
  return `sessionPromptShown_${today}`
}

// Fetch data on mount
onMounted(async () => {
  await sessionsStore.fetchSessions()
  await booksStore.fetchBooks()
  await goalsStore.fetchGoals()
  
  // Check if we should show the prompt
  checkAndShowPrompt()
})

// Watch for session changes to hide prompt if session is added
watch(() => sessionsStore.sessions, () => {
  if (hasSessionToday.value && showPrompt.value) {
    showPrompt.value = false
  }
}, { deep: true })

const checkAndShowPrompt = () => {
  // Only show if no session today and prompt hasn't been shown today
  const promptKey = getPromptShownKey()
  const wasShown = localStorage.getItem(promptKey) === 'true'
  
  if (!hasSessionToday.value && !wasShown && sessionsStore.sessions.length > 0) {
    // Small delay to let the page render first
    setTimeout(() => {
      showPrompt.value = true
    }, 1000)
  }
}

// Get last session for creating similar session
const getLastSession = (): ReadingSession | null => {
  if (sessionsStore.sessions.length === 0) return null
  const sorted = [...sessionsStore.sessions]
    .filter(s => s.date)
    .sort((a, b) => b.date!.toDate().getTime() - a.date!.toDate().getTime())
  return sorted[0] || null
}

// Handle prompt confirmation - create session similar to last one
const handlePromptConfirm = async () => {
  const lastSession = getLastSession()
  if (!lastSession) {
    // If no last session, just open the form
    showPrompt.value = false
    return
  }
  
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Create start time (default to 9 AM)
    const startDateTime = new Date(today)
    startDateTime.setHours(9, 0, 0, 0)
    
    // Calculate end time based on last session's duration
    const endDateTime = new Date(startDateTime)
    endDateTime.setMinutes(endDateTime.getMinutes() + (lastSession.duration || 0))
    
    const sessionData: Omit<ReadingSession, 'id' | 'createdAt'> = {
      date: Timestamp.fromDate(today),
      startTime: Timestamp.fromDate(startDateTime),
      endTime: Timestamp.fromDate(endDateTime),
      duration: lastSession.duration || 0,
      ...(lastSession.bookId && { bookId: lastSession.bookId })
    }
    
    await sessionsStore.createSession(sessionData)
    
    // Mark prompt as shown for today
    const promptKey = getPromptShownKey()
    localStorage.setItem(promptKey, 'true')
    
    showPrompt.value = false
  } catch (error) {
    console.error('Error creating session:', error)
    // On error, just close the prompt
    showPrompt.value = false
  }
}

// Handle prompt cancellation
const handlePromptCancel = () => {
  // Mark prompt as shown for today so it doesn't show again
  const promptKey = getPromptShownKey()
  localStorage.setItem(promptKey, 'true')
  showPrompt.value = false
}

// Calculate today's total
const todayTotal = computed(() => {
  return sessionsStore.sessions
    .filter(session => session.date && isToday(session.date.toDate()))
    .reduce((total, session) => total + (session.duration || 0), 0)
})

const todaySessions = computed(() => {
  return sessionsStore.sessions.filter(session => session.date && isToday(session.date.toDate())).length
})

// Calculate week's total
const weekTotal = computed(() => {
  return sessionsStore.sessions
    .filter(session => session.date && isThisWeek(session.date.toDate()))
    .reduce((total, session) => total + (session.duration || 0), 0)
})

const weekSessions = computed(() => {
  return sessionsStore.sessions.filter(session => session.date && isThisWeek(session.date.toDate())).length
})

// Calculate month's total
const monthTotal = computed(() => {
  return sessionsStore.sessions
    .filter(session => session.date && isThisMonth(session.date.toDate()))
    .reduce((total, session) => total + (session.duration || 0), 0)
})

const monthSessions = computed(() => {
  return sessionsStore.sessions.filter(session => session.date && isThisMonth(session.date.toDate())).length
})

// Calculate year's total
const yearTotal = computed(() => {
  return sessionsStore.sessions
    .filter(session => session.date && isThisYear(session.date.toDate()))
    .reduce((total, session) => total + (session.duration || 0), 0)
})

const yearSessions = computed(() => {
  return sessionsStore.sessions.filter(session => session.date && isThisYear(session.date.toDate())).length
})

// Get user's daily goal (if set)
const dailyGoal = computed(() => {
  return goalsStore.goals.find(g => g.type === 'daily') || null
})

const dailyGoalTarget = computed(() => {
  return dailyGoal.value?.targetMinutes ?? null
})

// Calculate averages (divided by all calendar days in the period, not just days with reading)
const weekDailyAverage = computed(() => {
  if (weekTotal.value === 0) return 0
  
  const now = new Date()
  const weekStart = startOfWeek(now)
  const calendarDays = eachDayOfInterval({ start: weekStart, end: now }).length
  
  return Math.round(weekTotal.value / calendarDays)
})

const monthDailyAverage = computed(() => {
  if (monthTotal.value === 0) return 0
  
  const now = new Date()
  const monthStart = startOfMonth(now)
  const calendarDays = eachDayOfInterval({ start: monthStart, end: now }).length
  
  return Math.round(monthTotal.value / calendarDays)
})

// Calculate reading streak
const readingStreak = computed(() => {
  if (sessionsStore.sessions.length === 0) return 0
  
  const sortedSessions = [...sessionsStore.sessions]
    .filter(s => s.date)
    .sort((a, b) => b.date!.toDate().getTime() - a.date!.toDate().getTime())
  
  if (sortedSessions.length === 0) return 0
  
  const uniqueDates = new Set(
    sortedSessions.map(s => formatDate(s.date!.toDate(), 'yyyy-MM-dd'))
  )
  
  const dates = Array.from(uniqueDates).sort().reverse()
  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  for (let i = 0; i < dates.length; i++) {
    const date = new Date(dates[i])
    date.setHours(0, 0, 0, 0)
    
    const expectedDate = new Date(today)
    expectedDate.setDate(expectedDate.getDate() - i)
    
    if (formatDate(date, 'yyyy-MM-dd') === formatDate(expectedDate, 'yyyy-MM-dd')) {
      streak++
    } else {
      break
    }
  }
  
  return streak
})

// Books counts
const readingBooksCount = computed(() => {
  return booksStore.books.filter(b => b.status === 'reading').length
})

const completedBooksCount = computed(() => {
  return booksStore.books.filter(b => b.status === 'completed').length
})

const wantToReadBooksCount = computed(() => {
  return booksStore.books.filter(b => b.status === 'wantToRead').length
})

// Chart data
const chartData = computed(() => {
  const now = new Date()
  let startDate: Date
  const endDate = now
  
  if (chartPeriod.value === 'week') {
    startDate = startOfWeek(now)
  } else if (chartPeriod.value === 'month') {
    startDate = startOfMonth(now)
  } else {
    startDate = startOfYear(now)
  }
  
  const days = eachDayOfInterval({ start: startDate, end: endDate })
  const sessionsByDate = new Map<string, number>()
  
  sessionsStore.sessions.forEach(session => {
    if (!session.date) return
    const dateKey = formatDate(session.date.toDate(), 'yyyy-MM-dd')
    const dayDate = new Date(dateKey)
    
    if (dayDate >= startDate && dayDate <= endDate) {
      sessionsByDate.set(dateKey, (sessionsByDate.get(dateKey) || 0) + (session.duration || 0))
    }
  })
  
  return {
    labels: days.map(d => formatDate(d, chartPeriod.value === 'year' ? 'MMM' : 'EEE')),
    data: days.map(d => {
      const dateKey = formatDate(d, 'yyyy-MM-dd')
      return sessionsByDate.get(dateKey) || 0
    })
  }
})

const updateCharts = () => {
  // Charts will reactively update
}

const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

// Get active goals
const activeGoals = computed(() => {
  const now = new Date()
  const currentYear = getYear(now)
  const currentMonth = now.getMonth() + 1
  const currentWeek = getWeek(now)

  return goalsStore.goals.filter(goal => {
    if (goal.type === 'daily') {
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

  return {
    current: currentMinutes,
    target: goal.targetMinutes,
    percentage
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
</script>
