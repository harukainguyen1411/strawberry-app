<template>
  <div class="relative">
    <!-- Local Mode Indicator -->
    <div class="relative" ref="dropdownRef">
      <button
        @click="toggleDropdown"
        class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Local mode menu"
        :disabled="syncing"
      >
        <div class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
          📱
        </div>
        <span class="hidden md:block text-sm font-medium text-gray-700">
          {{ $t('localMode.indicator') }}
        </span>
        <svg
          class="w-4 h-4 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      <!-- Dropdown Menu -->
      <div
        v-if="showDropdown && !syncing"
        class="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
      >
        <div class="px-4 py-3 border-b border-gray-200">
          <p class="text-sm font-medium text-gray-900">{{ $t('localMode.title') }}</p>
          <p class="text-xs text-gray-500 mt-1">{{ $t('localMode.description') }}</p>
        </div>
        <router-link
          to="/settings"
          @click="closeDropdown"
          class="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {{ $t('settings.title') }}
        </router-link>
        <button
          @click="handleSignIn"
          class="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
          {{ $t('localMode.signInWithGoogle') }}
        </button>
        <button
          @click="handleClearLocal"
          class="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          {{ $t('localMode.clearLocalMemory') }}
        </button>
      </div>
    </div>

    <!-- Sync Conflict Modal - Use Teleport to ensure it's always rendered -->
    <Teleport to="body">
      <SyncConflictModal
        :show="showSyncModal"
        @strategy="handleSyncStrategy"
        @cancel="handleSyncCancel"
      />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useClickOutside } from '@/composables/useClickOutside'
import { useI18n } from 'vue-i18n'
import SyncConflictModal from './SyncConflictModal.vue'
import { syncLocalToFirebase, type SyncStrategy } from '@/utils/dataSync'

const { t } = useI18n()
const authStore = useAuthStore()
const showDropdown = ref(false)
const dropdownRef = ref<HTMLElement>()
const syncing = ref(false)
const showSyncModal = ref(false)
const pendingUser = ref<string | null>(null)

const toggleDropdown = (): void => {
  showDropdown.value = !showDropdown.value
}

const closeDropdown = (): void => {
  showDropdown.value = false
}

const handleSignIn = async (): Promise<void> => {
  try {
    closeDropdown()
    syncing.value = true
    
    // Sign in with Google (skip auto-disable of local mode)
    const user = await authStore.login(true)
    pendingUser.value = user.uid
    
    // Always show sync modal when logging in from local mode
    // User should decide what to do with local data
    // Use nextTick to ensure component is still mounted and DOM is updated
    await nextTick()
    showSyncModal.value = true
    syncing.value = false
    console.log('Sync modal should be visible:', showSyncModal.value, 'syncingFromLocal:', authStore.syncingFromLocal)
  } catch (error) {
    console.error('Sign in error:', error)
    syncing.value = false
    alert(t('localMode.syncError'))
  }
}

const handleSyncStrategy = async (strategy: SyncStrategy): Promise<void> => {
  if (!pendingUser.value) return
  
  try {
    syncing.value = true
    showSyncModal.value = false
    
    // If user chooses to use account data, clear local storage
    if (strategy === 'useAccount') {
      // Clear all local storage data
      const STORAGE_KEYS = [
        'readTracker_books',
        'readTracker_sessions',
        'readTracker_goals',
        'readTracker_localModeWarningDismissed'
      ]
      STORAGE_KEYS.forEach(key => localStorage.removeItem(key))
      // Complete sync (disables local mode)
      authStore.completeLocalModeSync()
      syncing.value = false
      // Refresh stores to load account data
      window.location.reload()
      return
    }
    
    // For 'merge', sync the data
    const result = await syncLocalToFirebase(pendingUser.value, strategy)
    
    if (result.success) {
      // Clear local storage data after successful sync
      const STORAGE_KEYS = [
        'readTracker_books',
        'readTracker_sessions',
        'readTracker_goals',
        'readTracker_localModeWarningDismissed'
      ]
      STORAGE_KEYS.forEach(key => localStorage.removeItem(key))
      // Complete sync (disables local mode)
      authStore.completeLocalModeSync()
      syncing.value = false
      // Refresh stores to load synced data
      window.location.reload()
    } else {
      throw new Error(result.error || 'Sync failed')
    }
  } catch (error) {
    console.error('Sync error:', error)
    syncing.value = false
    alert(t('localMode.syncError'))
  }
}

const handleSyncCancel = (): void => {
  showSyncModal.value = false
  syncing.value = false
  // Sign out if user just signed in
  if (pendingUser.value) {
    authStore.signOut()
    pendingUser.value = null
  }
}

const handleClearLocal = (): void => {
  if (confirm(t('localMode.clearConfirm'))) {
    authStore.clearLocalData()
    closeDropdown()
  }
}

useClickOutside(dropdownRef, closeDropdown)
</script>
