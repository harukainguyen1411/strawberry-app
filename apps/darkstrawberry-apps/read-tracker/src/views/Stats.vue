<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Weekly Average -->
    <div class="bg-white rounded-lg shadow p-4 sm:p-6">
      <div class="flex items-center justify-between mb-3 sm:mb-4">
        <h3 class="text-base sm:text-lg font-semibold text-gray-900">{{ $t('stats.weeklyAverage') }}</h3>
        <span v-if="dailyGoalTarget" class="text-xs sm:text-sm text-gray-500">
          {{ $t('dashboard.goalTarget', { goal: formatDuration(dailyGoalTarget) }) }}
        </span>
      </div>
      <div v-if="weeklyChartData.labels.length > 0">
        <AverageTrendsChart :data="weeklyChartData" :goal-target="dailyGoalTarget" />
      </div>
      <div v-else class="h-56 sm:h-72 flex items-center justify-center text-gray-400 text-sm">
        {{ $t('stats.noData') }}
      </div>
    </div>

    <!-- Monthly Average -->
    <div class="bg-white rounded-lg shadow p-4 sm:p-6">
      <div class="flex items-center justify-between mb-3 sm:mb-4">
        <h3 class="text-base sm:text-lg font-semibold text-gray-900">{{ $t('stats.monthlyAverage') }}</h3>
        <span v-if="dailyGoalTarget" class="text-xs sm:text-sm text-gray-500">
          {{ $t('dashboard.goalTarget', { goal: formatDuration(dailyGoalTarget) }) }}
        </span>
      </div>
      <div v-if="monthlyChartData.labels.length > 0">
        <AverageTrendsChart :data="monthlyChartData" :goal-target="dailyGoalTarget" />
      </div>
      <div v-else class="h-56 sm:h-72 flex items-center justify-center text-gray-400 text-sm">
        {{ $t('stats.noData') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useReadingSessionsStore } from '@/stores/readingSessions'
import { useGoalsStore } from '@/stores/goals'
import AverageTrendsChart from '@/components/ReadTracker/AverageTrendsChart.vue'
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subWeeks,
  subMonths,
  eachDayOfInterval,
  format as formatDate,
  getDaysInMonth,
  isAfter,
  isBefore,
  isSameDay
} from 'date-fns'

const sessionsStore = useReadingSessionsStore()
const goalsStore = useGoalsStore()

onMounted(async () => {
  await sessionsStore.fetchSessions()
  await goalsStore.fetchGoals()
})

// Get user's daily goal
const dailyGoalTarget = computed(() => {
  const dailyGoal = goalsStore.goals.find(g => g.type === 'daily')
  return dailyGoal?.targetMinutes ?? null
})

const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

// Compute weekly averages for the last 12 weeks
const weeklyChartData = computed(() => {
  const now = new Date()
  const labels: string[] = []
  const data: number[] = []

  for (let i = 11; i >= 0; i--) {
    const weekDate = subWeeks(now, i)
    const weekStart = startOfWeek(weekDate)
    const weekEnd = endOfWeek(weekDate)

    // For the current week, only count days up to today
    const effectiveEnd = isAfter(weekEnd, now) ? now : weekEnd
    const calendarDays = eachDayOfInterval({ start: weekStart, end: effectiveEnd }).length

    // Sum sessions in this week
    const weekTotal = sessionsStore.sessions
      .filter(s => {
        if (!s.date) return false
        const d = s.date.toDate()
        return (isAfter(d, weekStart) || isSameDay(d, weekStart)) &&
               (isBefore(d, weekEnd) || isSameDay(d, weekEnd))
      })
      .reduce((total, s) => total + (s.duration || 0), 0)

    const avg = calendarDays > 0 ? Math.round(weekTotal / calendarDays) : 0

    // Label: "Jan 6" (start of week)
    labels.push(formatDate(weekStart, 'MMM d'))
    data.push(avg)
  }

  return { labels, data }
})

// Compute monthly averages for the last 12 months
const monthlyChartData = computed(() => {
  const now = new Date()
  const labels: string[] = []
  const data: number[] = []

  for (let i = 11; i >= 0; i--) {
    const monthDate = subMonths(now, i)
    const monthStart = startOfMonth(monthDate)
    const monthEnd = endOfMonth(monthDate)

    // For the current month, only count days up to today
    const effectiveEnd = isAfter(monthEnd, now) ? now : monthEnd
    const calendarDays = eachDayOfInterval({ start: monthStart, end: effectiveEnd }).length

    // Sum sessions in this month
    const monthTotal = sessionsStore.sessions
      .filter(s => {
        if (!s.date) return false
        const d = s.date.toDate()
        return (isAfter(d, monthStart) || isSameDay(d, monthStart)) &&
               (isBefore(d, monthEnd) || isSameDay(d, monthEnd))
      })
      .reduce((total, s) => total + (s.duration || 0), 0)

    const totalDaysInMonth = getDaysInMonth(monthDate)
    // For past months use full month days; for current month use elapsed days
    const divisor = isAfter(monthEnd, now) ? calendarDays : totalDaysInMonth
    const avg = divisor > 0 ? Math.round(monthTotal / divisor) : 0

    // Label: "Jan"
    labels.push(formatDate(monthStart, 'MMM'))
    data.push(avg)
  }

  return { labels, data }
})
</script>
