<template>
  <div class="min-h-screen flex items-center justify-center px-4" style="background: var(--bg)">
    <div class="w-full max-w-sm">
      <div class="mb-8 text-center">
        <span class="text-4xl mb-3 block">🍓</span>
        <h1 class="text-2xl font-medium" style="color: var(--text)">Strawberry · Portfolio</h1>
        <p class="text-sm mt-1" style="color: var(--muted)">Sign in to continue</p>
      </div>

      <div
        class="rounded-2xl p-6 border"
        style="background: var(--surface); border-color: var(--border)"
      >
        <template v-if="!linkSent">
          <form @submit.prevent="handleSendLink">
            <label class="block text-sm mb-2" style="color: var(--muted)" for="email">
              Email address
            </label>
            <input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              required
              placeholder="you@example.com"
              class="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
              style="
                background: var(--surface-hi);
                border: 1px solid var(--border-hi);
                color: var(--text);
              "
            />
            <p v-if="error" class="mt-2 text-sm" style="color: var(--accent)">{{ error }}</p>
            <button
              type="submit"
              :disabled="sending || !email"
              class="mt-4 w-full rounded-lg py-2 text-sm font-medium transition-opacity disabled:opacity-50"
              style="background: var(--accent); color: #fff"
            >
              {{ sending ? 'Sending…' : 'Send sign-in link' }}
            </button>
          </form>
        </template>

        <template v-else>
          <div class="text-center">
            <p class="text-base font-medium mb-2" style="color: var(--text)">Check your email</p>
            <p class="text-sm" style="color: var(--muted)">
              We sent a sign-in link to <strong>{{ email }}</strong>. Open it on this device to
              sign in.
            </p>
            <button
              class="mt-4 text-sm underline"
              style="color: var(--muted)"
              @click="linkSent = false"
            >
              Use a different email
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { sendSignInLink } from '@/auth/emailLink'

const email = ref('')
const sending = ref(false)
const linkSent = ref(false)
const error = ref('')

async function handleSendLink() {
  sending.value = true
  error.value = ''
  try {
    await sendSignInLink(email.value)
    linkSent.value = true
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to send link. Please try again.'
    error.value = msg
  } finally {
    sending.value = false
  }
}
</script>
