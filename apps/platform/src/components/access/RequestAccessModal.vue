<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center px-4" @click.self="$emit('close')">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
    <div class="relative ds-glass max-w-md w-full p-6 sm:p-8 rounded-2xl">

      <!-- Already requested -->
      <template v-if="existingRequest">
        <div class="text-center">
          <div class="text-4xl mb-4">
            <span v-if="existingRequest.status === 'pending'">⏳</span>
            <span v-else-if="existingRequest.status === 'approved'">✅</span>
            <span v-else>❌</span>
          </div>
          <h2 class="font-display text-xl font-semibold text-ds-text mb-2">
            <span v-if="existingRequest.status === 'pending'">Request Sent</span>
            <span v-else-if="existingRequest.status === 'approved'">Access Approved</span>
            <span v-else>Request Denied</span>
          </h2>
          <p class="text-ds-muted text-sm mb-6">
            <span v-if="existingRequest.status === 'pending'">
              Your request is pending. The owner will be notified and can approve or deny it.
            </span>
            <span v-else-if="existingRequest.status === 'approved'">
              Your access was approved. Try refreshing the page.
            </span>
            <span v-else>
              Your request was denied. Contact the owner if you think this is a mistake.
            </span>
          </p>
          <button class="ds-btn-secondary text-sm px-5 py-2 rounded-xl" @click="$emit('close')">
            Close
          </button>
        </div>
      </template>

      <!-- Rate limit hit -->
      <template v-else-if="rateLimitExceeded">
        <div class="text-center">
          <div class="text-4xl mb-4">🚫</div>
          <h2 class="font-display text-xl font-semibold text-ds-text mb-2">Request Limit Reached</h2>
          <p class="text-ds-muted text-sm mb-6">
            You've reached your app request limit ({{ userProfile?.maxAppRequests ?? 1 }}).
            Contact the platform owner to increase your quota.
          </p>
          <button class="ds-btn-secondary text-sm px-5 py-2 rounded-xl" @click="$emit('close')">
            Close
          </button>
        </div>
      </template>

      <!-- Request form -->
      <template v-else-if="!submitted">
        <h2 class="font-display text-xl font-semibold text-ds-text mb-1">Request Access</h2>
        <p class="text-ds-muted text-sm mb-6">
          Send a request to try <strong class="text-ds-text">{{ appName }}</strong>.
          The owner will be notified and can approve or deny your request.
        </p>

        <p v-if="error" class="text-red-400 text-sm mb-4">{{ error }}</p>

        <div class="flex gap-3">
          <button
            class="ds-btn-secondary text-sm px-5 py-2 rounded-xl flex-1"
            @click="$emit('close')"
          >
            Cancel
          </button>
          <button
            class="ds-btn-primary text-sm px-5 py-2 rounded-xl flex-1 flex items-center justify-center gap-2"
            :disabled="submitting"
            @click="handleSubmit"
          >
            <span v-if="submitting" class="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
            {{ submitting ? 'Sending...' : 'Send Request' }}
          </button>
        </div>
      </template>

      <!-- Success -->
      <template v-else>
        <div class="text-center">
          <div class="text-4xl mb-4">📨</div>
          <h2 class="font-display text-xl font-semibold text-ds-text mb-2">Request Sent</h2>
          <p class="text-ds-muted text-sm mb-6">
            The owner has been notified. You'll get access once they approve your request.
          </p>
          <button class="ds-btn-primary text-sm px-5 py-2 rounded-xl" @click="$emit('close')">
            Done
          </button>
        </div>
      </template>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { submitAccessRequest, type AccessRequest, type UserProfile } from '../../firebase/platformFirestore'

const props = defineProps<{
  appId: string
  appName: string
  userId: string
  userProfile: UserProfile | null
  existingRequest?: AccessRequest | null
  rateLimitExceeded?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submitted'): void
}>()

const submitting = ref(false)
const submitted = ref(false)
const error = ref<string | null>(null)

async function handleSubmit() {
  if (!props.userProfile) return
  submitting.value = true
  error.value = null
  try {
    await submitAccessRequest(props.appId, props.userId, props.userProfile)
    submitted.value = true
    emit('submitted')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.startsWith('rate_limit_exceeded')) {
      error.value = 'You have reached your request limit.'
    } else if (msg === 'request_already_pending') {
      error.value = 'You already have a pending request for this app.'
    } else {
      error.value = 'Failed to send request. Please try again.'
    }
  } finally {
    submitting.value = false
  }
}
</script>
