<template>
  <div class="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col items-center gap-3">
      <div class="w-6 h-6 rounded-full border-2 border-ds-border border-t-ds-accent animate-spin"></div>
      <p class="text-ds-muted text-sm">Checking access...</p>
    </div>

    <template v-else>
      <div class="mb-6 text-ds-accent flex justify-center"><DsIcon name="lock" :size="48" /></div>
      <h1 class="font-display text-2xl font-semibold text-ds-text mb-2">Access Required</h1>
      <p class="text-ds-muted mb-6 max-w-sm text-sm leading-relaxed">
        <template v-if="appRecord?.name">
          <strong class="text-ds-text">{{ appRecord.name }}</strong> is a private app.
        </template>
        <template v-else>This app is private.</template>
        <span v-if="appRecord?.access.allowTryRequests && authStore.isAuthenticated">
          You can request access and the owner will be notified.
        </span>
        <span v-else-if="!authStore.isAuthenticated">
          Sign in to request access.
        </span>
      </p>

      <div class="flex flex-wrap gap-3 justify-center">
        <router-link
          to="/"
          class="px-4 py-2 rounded-xl border border-ds-border text-ds-muted hover:text-ds-text hover:border-ds-accent/50 transition-colors text-sm font-medium"
        >
          Back to home
        </router-link>

        <button
          v-if="appRecord?.access.allowTryRequests && authStore.isAuthenticated"
          class="ds-btn-primary px-4 py-2 rounded-xl text-sm font-medium"
          @click="showModal = true"
        >
          {{ existingRequest ? 'View Request Status' : 'Request Access' }}
        </button>
      </div>
    </template>

    <!-- Request modal -->
    <RequestAccessModal
      v-if="showModal && appId && authStore.user"
      :app-id="appId"
      :app-name="appRecord?.name ?? appId"
      :user-id="authStore.user.uid"
      :user-profile="userProfile"
      :existing-request="existingRequest"
      :rate-limit-exceeded="rateLimitExceeded"
      @close="showModal = false"
      @submitted="onSubmitted"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { DsIcon } from '@shared/ui/icons'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  getAppRecord,
  getUserProfile,
  getUserRequestForApp,
  type AppRecord,
  type UserProfile,
  type AccessRequest
} from '../firebase/platformFirestore'
import RequestAccessModal from '../components/access/RequestAccessModal.vue'

const route = useRoute()
const authStore = useAuthStore()

const appId = computed(() => route.query.appId as string | undefined)

const loading = ref(true)
const showModal = ref(false)
const appRecord = ref<AppRecord | null>(null)
const userProfile = ref<UserProfile | null>(null)
const existingRequest = ref<AccessRequest | null>(null)
const rateLimitExceeded = ref(false)

onMounted(async () => {
  try {
    if (appId.value) {
      appRecord.value = await getAppRecord(appId.value)
    }

    if (authStore.user?.uid) {
      const uid = authStore.user.uid
      userProfile.value = await getUserProfile(uid)

      if (appId.value) {
        existingRequest.value = await getUserRequestForApp(appId.value, uid)
      }

      // Check rate limit
      const profile = userProfile.value
      if (profile && profile.role !== 'admin' && profile.role !== 'collaborator') {
        const limit = profile.maxAppRequests ?? 1
        if (limit !== -1 && !existingRequest.value) {
          // We'll let submitAccessRequest enforce this server-side,
          // but we pre-check to show the right UI state
          rateLimitExceeded.value = false // optimistic — modal handles the real check
        }
      }
    }
  } finally {
    loading.value = false
  }
})

function onSubmitted() {
  // Reload the existing request state after submission
  if (appId.value && authStore.user?.uid) {
    getUserRequestForApp(appId.value, authStore.user.uid).then(req => {
      existingRequest.value = req
    })
  }
}
</script>
