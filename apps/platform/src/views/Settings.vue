<template>
  <div class="py-4 sm:py-6 lg:py-8 max-w-2xl">
    <h1 class="font-display text-2xl sm:text-3xl font-semibold text-ds-text mb-6 tracking-tight">
      Settings
    </h1>

    <!-- Loading -->
    <div v-if="loading" class="ds-glass p-8 text-center">
      <div class="w-6 h-6 rounded-full border-2 border-ds-border border-t-ds-accent animate-spin mx-auto mb-3"></div>
      <p class="text-ds-muted text-sm">Loading settings...</p>
    </div>

    <template v-else>
      <!-- Account -->
      <div class="ds-glass p-5 sm:p-6 mb-5">
        <h2 class="text-xs font-medium uppercase tracking-widest text-ds-muted mb-4">Account</h2>
        <div class="flex items-center gap-4">
          <img
            v-if="authStore.user?.photoURL"
            :src="authStore.user.photoURL"
            :alt="authStore.user.displayName || 'User'"
            class="w-12 h-12 rounded-full flex-shrink-0"
          />
          <div class="min-w-0">
            <p class="text-sm font-medium text-ds-text truncate">{{ authStore.user?.displayName }}</p>
            <p class="text-xs text-ds-muted truncate">{{ authStore.user?.email }}</p>
          </div>
        </div>
      </div>

      <!-- Notifications -->
      <div class="ds-glass p-5 sm:p-6 mb-5">
        <h2 class="text-xs font-medium uppercase tracking-widest text-ds-muted mb-4">Notifications</h2>

        <div class="space-y-4">
          <!-- Channel selector -->
          <div>
            <label class="text-sm text-ds-text font-medium block mb-2">Notification Channel</label>
            <div class="flex gap-3">
              <button
                @click="setChannel('email')"
                class="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border transition-all duration-200"
                :class="profile.notificationChannel === 'email'
                  ? 'border-ds-accent bg-ds-accent/10 text-ds-accent'
                  : 'border-ds-border text-ds-muted hover:border-ds-muted hover:text-ds-text'"
              >
                Email
              </button>
              <button
                @click="setChannel('discord')"
                class="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border transition-all duration-200"
                :class="profile.notificationChannel === 'discord'
                  ? 'border-ds-accent bg-ds-accent/10 text-ds-accent'
                  : 'border-ds-border text-ds-muted hover:border-ds-muted hover:text-ds-text'"
              >
                Discord
              </button>
            </div>
          </div>

          <!-- Discord User ID (shown when Discord is selected) -->
          <div v-if="profile.notificationChannel === 'discord'">
            <label for="discord-id" class="text-sm text-ds-text font-medium block mb-1.5">Discord User ID</label>
            <p class="text-xs text-ds-muted mb-2">
              Right-click your name in Discord and select "Copy User ID" (requires Developer Mode).
            </p>
            <div class="flex gap-2">
              <input
                id="discord-id"
                v-model="profile.discordUserId"
                type="text"
                placeholder="e.g. 123456789012345678"
                class="flex-1 bg-ds-surface border border-ds-border rounded-xl px-3 py-2 text-sm text-ds-text
                       placeholder-ds-muted/50 focus:outline-none focus:border-ds-accent focus:ring-1 focus:ring-ds-accent/30"
              />
              <button
                @click="saveDiscordId"
                :disabled="saving"
                class="ds-btn-primary px-4 py-2 rounded-xl text-sm font-medium"
              >
                {{ saving ? 'Saving...' : 'Save' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Status messages -->
      <p v-if="saveSuccess" class="text-xs text-green-400 mt-2">Settings saved.</p>
      <p v-if="saveError" class="text-xs text-red-400 mt-2">{{ saveError }}</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getUserProfile, updateUserProfile, setUserProfile } from '../firebase/platformFirestore'

const authStore = useAuthStore()
const loading = ref(true)
const saving = ref(false)
const saveSuccess = ref(false)
const saveError = ref('')

const profile = reactive({
  notificationChannel: 'email' as 'email' | 'discord',
  discordUserId: ''
})

async function setChannel(channel: 'email' | 'discord') {
  profile.notificationChannel = channel
  saving.value = true
  saveSuccess.value = false
  saveError.value = ''
  try {
    const userId = authStore.user?.uid
    if (!userId) return
    await updateUserProfile(userId, { notificationChannel: channel })
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 2000)
  } catch (e) {
    saveError.value = 'Failed to update notification channel.'
    console.error(e)
  } finally {
    saving.value = false
  }
}

async function saveDiscordId() {
  saving.value = true
  saveSuccess.value = false
  saveError.value = ''
  try {
    const userId = authStore.user?.uid
    if (!userId) return
    if (!profile.discordUserId.trim()) {
      saveError.value = 'Discord User ID cannot be empty.'
      return
    }
    await updateUserProfile(userId, { discordUserId: profile.discordUserId.trim() })
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 2000)
  } catch (e) {
    saveError.value = 'Failed to save Discord ID.'
    console.error(e)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  const userId = authStore.user?.uid
  if (!userId) {
    loading.value = false
    return
  }

  try {
    const existing = await getUserProfile(userId)
    if (existing) {
      profile.notificationChannel = existing.notificationChannel || 'email'
      profile.discordUserId = existing.discordUserId || ''
    } else {
      // Seed initial profile
      await setUserProfile(userId, {
        displayName: authStore.user?.displayName || undefined,
        email: authStore.user?.email || undefined,
        photoURL: authStore.user?.photoURL || undefined,
        role: 'user',
        maxAppRequests: 1,
        notificationChannel: 'email'
      })
    }
  } catch (e) {
    console.error('Failed to load profile:', e)
  } finally {
    loading.value = false
  }
})
</script>
