<template>
  <!-- SignInView — portfolio sign-in; email-link auth implemented in V0.2 -->
  <div class="min-h-screen flex items-center justify-center px-4" style="background: var(--bg);">
    <div class="w-full max-w-sm">
      <div class="ds-glass rounded-2xl p-8">
        <h1 class="text-xl font-semibold mb-2" style="color: var(--text);">
          Strawberry · Portfolio
        </h1>
        <p class="text-sm mb-6" style="color: var(--muted);">Sign in to access your portfolio.</p>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1.5" style="color: var(--muted);" for="email">
              Email address
            </label>
            <input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              required
              class="w-full px-3 py-2 rounded-lg text-sm transition-colors"
              style="background: var(--surface-hi); border: 1px solid var(--border-hi); color: var(--text);"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            :disabled="sending || !email"
            class="ds-btn-primary w-full py-2.5"
          >
            {{ sending ? 'Sending…' : 'Send sign-in link' }}
          </button>
        </form>

        <p v-if="sent" class="mt-4 text-sm text-center" style="color: var(--positive);">
          Check your inbox for the sign-in link.
        </p>
        <p v-if="error" class="mt-4 text-sm text-center" style="color: var(--negative);">
          {{ error }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const email = ref('')
const sending = ref(false)
const sent = ref(false)
const error = ref('')

async function handleSubmit() {
  if (!email.value) return
  sending.value = true
  error.value = ''
  try {
    // Email link auth implemented in V0.2 functions/onSignIn.ts
    // For v0 shell: import { sendSignInLink } from '@/auth/emailLink'
    // await sendSignInLink(email.value)
    sent.value = true
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Sign-in failed. Please try again.'
  } finally {
    sending.value = false
  }
}
</script>
