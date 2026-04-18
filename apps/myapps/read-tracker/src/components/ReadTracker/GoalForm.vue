<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4" @click.self="$emit('close')">
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
      <div class="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
        <h3 class="text-lg sm:text-xl font-semibold text-gray-900">
          {{ editingGoal ? $t('goals.editGoal') : $t('goals.createGoal') }}
        </h3>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-gray-600 transition-colors p-1 touch-manipulation"
          aria-label="Close"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form @submit.prevent="handleSubmit" class="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <!-- Goal Type -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            {{ $t('goals.goalType') }} <span class="text-red-500">*</span>
          </label>
          <select
            v-model="formData.type"
            required
            @change="updatePeriodFields"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="daily">{{ $t('goals.types.daily') }}</option>
            <option value="weekly">{{ $t('goals.types.weekly') }}</option>
            <option value="monthly">{{ $t('goals.types.monthly') }}</option>
            <option value="yearly">{{ $t('goals.types.yearly') }}</option>
          </select>
        </div>

        <!-- Target Minutes -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            {{ $t('goals.targetReadingTime') }} <span class="text-red-500">*</span>
          </label>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-gray-500 mb-1">{{ $t('sessionForm.hours') }}</label>
              <input
                v-model.number="formData.hours"
                type="number"
                min="0"
                max="24"
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="0"
              />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">{{ $t('sessionForm.minutes') }}</label>
              <input
                v-model.number="formData.minutes"
                type="number"
                min="0"
                max="59"
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="0"
              />
            </div>
          </div>
          <p v-if="totalMinutes > 0" class="mt-2 text-sm text-gray-600">
            {{ $t('sessionForm.total') }}: {{ formatDuration(totalMinutes) }} {{ $t('goals.per') }} {{ formData.type === 'daily' ? $t('goals.day') : formData.type === 'weekly' ? $t('goals.week') : formData.type === 'monthly' ? $t('goals.month') : $t('goals.year') }}
          </p>
          <p v-if="errors.targetMinutes" class="mt-1 text-sm text-red-600">{{ errors.targetMinutes }}</p>
        </div>

        <!-- Period Selection (for weekly/monthly/yearly) -->
        <div v-if="formData.type !== 'daily'">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            {{ formData.type === 'weekly' ? $t('goals.week') : formData.type === 'monthly' ? $t('goals.month') : $t('goals.year') }}
          </label>
          <div class="grid grid-cols-2 gap-4">
            <div v-if="formData.type === 'weekly' || formData.type === 'monthly' || formData.type === 'yearly'">
              <label class="block text-xs text-gray-500 mb-1">{{ $t('goals.year') }}</label>
              <select
                v-model.number="formData.year"
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
              </select>
            </div>
            <div v-if="formData.type === 'weekly'">
              <label class="block text-xs text-gray-500 mb-1">{{ $t('goals.week') }}</label>
              <input
                v-model.number="formData.week"
                type="number"
                min="1"
                max="53"
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                :placeholder="$t('goals.weekNumber')"
              />
            </div>
            <div v-if="formData.type === 'monthly'">
              <label class="block text-xs text-gray-500 mb-1">{{ $t('goals.month') }}</label>
              <select
                v-model.number="formData.month"
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option v-for="month in 12" :key="month" :value="month">{{ getMonthName(month) }}</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="submitError" class="bg-red-50 border border-red-200 rounded-lg p-4">
          <p class="text-sm text-red-600">{{ submitError }}</p>
        </div>

        <!-- Actions -->
        <div class="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 justify-end pt-4 border-t border-gray-200">
          <button
            type="button"
            @click="$emit('close')"
            class="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors touch-manipulation"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            type="submit"
            :disabled="loading"
            class="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          >
            {{ loading ? $t('common.saving') : (editingGoal ? $t('goals.updateGoal') : $t('goals.createGoal')) }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGoalsStore } from '@/stores/goals'
import type { Goal } from '@/firebase/firestore'
import { getWeek, getYear } from 'date-fns'

interface Props {
  goal?: Goal | null
}

const props = withDefaults(defineProps<Props>(), {
  goal: null
})

const emit = defineEmits<{
  close: []
  save: []
}>()

const { t } = useI18n()

const goalsStore = useGoalsStore()

const loading = ref(false)
const submitError = ref('')
const errors = ref<Record<string, string>>({})

const editingGoal = computed(() => props.goal)

// Form data
const formData = ref({
  type: 'daily' as 'daily' | 'weekly' | 'monthly' | 'yearly',
  hours: 0,
  minutes: 0,
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  week: getWeek(new Date())
})

// Calculate total minutes
const totalMinutes = computed(() => {
  return (formData.value.hours || 0) * 60 + (formData.value.minutes || 0)
})

// Available years (current year and next year)
const availableYears = computed(() => {
  const currentYear = new Date().getFullYear()
  return [currentYear, currentYear + 1]
})

// Initialize form with goal data if editing
onMounted(() => {
  if (editingGoal.value) {
    const goal = editingGoal.value
    formData.value.type = goal.type
    formData.value.hours = Math.floor(goal.targetMinutes / 60)
    formData.value.minutes = goal.targetMinutes % 60
    formData.value.year = goal.year || new Date().getFullYear()
    formData.value.month = goal.month || new Date().getMonth() + 1
    formData.value.week = goal.week || getWeek(new Date())
  } else {
    // Set defaults for new goal
    const now = new Date()
    formData.value.year = getYear(now)
    formData.value.month = now.getMonth() + 1
    formData.value.week = getWeek(now)
  }
})

const updatePeriodFields = () => {
  // Reset period fields when type changes
  const now = new Date()
  formData.value.year = getYear(now)
  formData.value.month = now.getMonth() + 1
  formData.value.week = getWeek(now)
}

const getMonthName = (month: number): string => {
  const months = [
    t('goals.months.january'), t('goals.months.february'), t('goals.months.march'), t('goals.months.april'),
    t('goals.months.may'), t('goals.months.june'), t('goals.months.july'), t('goals.months.august'),
    t('goals.months.september'), t('goals.months.october'), t('goals.months.november'), t('goals.months.december')
  ]
  return months[month - 1]
}

const validateForm = (): boolean => {
  errors.value = {}

  if (totalMinutes.value <= 0) {
    errors.value.targetMinutes = t('goals.targetMinutesRequired')
  }

  return Object.keys(errors.value).length === 0
}

const handleSubmit = async () => {
  if (!validateForm()) {
    return
  }

  loading.value = true
  submitError.value = ''

  try {
    const goalData: Omit<Goal, 'id'> = {
      type: formData.value.type,
      targetMinutes: totalMinutes.value,
      ...(formData.value.type !== 'daily' && { year: formData.value.year }),
      ...(formData.value.type === 'weekly' && { week: formData.value.week }),
      ...(formData.value.type === 'monthly' && { month: formData.value.month })
    }

    if (editingGoal.value?.id) {
      await goalsStore.updateGoalData(editingGoal.value.id, goalData)
    } else {
      await goalsStore.createGoal(goalData)
    }

    emit('save')
  } catch (error) {
    console.error('Error saving goal:', error)
    submitError.value = t('goals.saveError')
  } finally {
    loading.value = false
  }
}

const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} ${t('sessionForm.minutes')}`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours} ${t('sessionForm.hours')} ${mins} ${t('sessionForm.minutes')}` : `${hours} ${t('sessionForm.hours')}`
}
</script>
