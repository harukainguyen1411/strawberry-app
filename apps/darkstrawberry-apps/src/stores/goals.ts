import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import { getGoals as getGoalsFirebase, addGoal as addGoalFirebase, updateGoal as updateGoalFirebase, deleteGoal as deleteGoalFirebase, type Goal } from '@/firebase/firestore'
import { getGoals as getGoalsLocal, addGoal as addGoalLocal, updateGoal as updateGoalLocal, deleteGoal as deleteGoalLocal } from '@/storage/localStorage'
import { useAuthStore } from './auth'
import type { DocumentReference, DocumentData } from 'firebase/firestore'

export const useGoalsStore = defineStore('goals', () => {
  const goals: Ref<Goal[]> = ref([])
  const loading: Ref<boolean> = ref(false)
  const error: Ref<string | null> = ref(null)

  const fetchGoals = async (): Promise<void> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return

    loading.value = true
    error.value = null
    try {
      if (authStore.localMode) {
        goals.value = await getGoalsLocal()
      } else if (authStore.user) {
        goals.value = await getGoalsFirebase(authStore.user.uid)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load goals'
      error.value = errorMessage
      console.error('Error fetching goals:', err)
    } finally {
      loading.value = false
    }
  }

  const createGoal = async (goalData: Omit<Goal, 'id'>): Promise<DocumentReference<DocumentData> | { id: string }> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) throw new Error('User not authenticated')

    error.value = null
    try {
      let docRef: DocumentReference<DocumentData> | { id: string }
      if (authStore.localMode) {
        docRef = await addGoalLocal(goalData)
      } else if (authStore.user) {
        docRef = await addGoalFirebase(authStore.user.uid, goalData)
      } else {
        throw new Error('User not authenticated')
      }
      await fetchGoals() // Refresh list
      return docRef
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create goal'
      error.value = errorMessage
      console.error('Error creating goal:', err)
      throw err
    }
  }

  const updateGoalData = async (goalId: string, updates: Partial<Goal>): Promise<void> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) throw new Error('User not authenticated')

    error.value = null
    try {
      if (authStore.localMode) {
        await updateGoalLocal(goalId, updates)
      } else if (authStore.user) {
        await updateGoalFirebase(authStore.user.uid, goalId, updates)
      } else {
        throw new Error('User not authenticated')
      }
      await fetchGoals() // Refresh list
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update goal'
      error.value = errorMessage
      console.error('Error updating goal:', err)
      throw err
    }
  }

  const removeGoal = async (goalId: string): Promise<void> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) throw new Error('User not authenticated')

    error.value = null
    try {
      if (authStore.localMode) {
        await deleteGoalLocal(goalId)
      } else if (authStore.user) {
        await deleteGoalFirebase(authStore.user.uid, goalId)
      } else {
        throw new Error('User not authenticated')
      }
      await fetchGoals() // Refresh list
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete goal'
      error.value = errorMessage
      console.error('Error deleting goal:', err)
      throw err
    }
  }

  return {
    goals,
    loading,
    error,
    fetchGoals,
    createGoal,
    updateGoalData,
    removeGoal
  }
})
