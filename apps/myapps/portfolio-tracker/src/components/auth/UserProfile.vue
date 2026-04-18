<template>
  <div class="relative">
    <!-- User Profile Dropdown -->
    <div class="relative" ref="dropdownRef">
      <button
        @click="toggleDropdown"
        class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="User menu"
      >
        <img
          v-if="user?.photoURL"
          :src="user.photoURL"
          :alt="user.displayName || 'User'"
          class="w-8 h-8 rounded-full"
        />
        <div
          v-else
          class="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold"
        >
          {{ userInitials }}
        </div>
        <span v-if="user?.displayName" class="hidden md:block text-sm font-medium text-gray-700">
          {{ user.displayName }}
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
        v-if="showDropdown"
        class="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
      >
        <div class="px-4 py-3 border-b border-gray-200">
          <p class="text-sm font-medium text-gray-900">{{ user?.displayName || 'User' }}</p>
          <p class="text-xs text-gray-500 truncate">{{ user?.email }}</p>
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
          @click="handleLogout"
          class="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {{ $t('common.signOut') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useClickOutside } from '@/composables/useClickOutside'
import { useI18n } from 'vue-i18n'
import type { User } from 'firebase/auth'

useI18n() // Required for $t() in template
const router = useRouter()
const authStore = useAuthStore()
const showDropdown = ref(false)
const dropdownRef = ref<HTMLElement>()

const user = computed<User | null>(() => authStore.user)

const userInitials = computed(() => {
  if (!user.value?.displayName) return 'U'
  const names = user.value.displayName.split(' ')
  if (names.length >= 2) {
    return (names[0][0] + names[names.length - 1][0]).toUpperCase()
  }
  return user.value.displayName.substring(0, 2).toUpperCase()
})

const toggleDropdown = (): void => {
  showDropdown.value = !showDropdown.value
}

const closeDropdown = (): void => {
  showDropdown.value = false
}

const handleLogout = async (): Promise<void> => {
  try {
    await authStore.signOut()
    closeDropdown()
    // Redirect to home page after sign out
    router.push('/')
  } catch (error) {
    console.error('Logout error:', error)
  }
}

useClickOutside(dropdownRef, closeDropdown)
</script>
