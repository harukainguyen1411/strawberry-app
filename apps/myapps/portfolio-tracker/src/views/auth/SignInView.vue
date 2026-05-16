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
        <button
          type="button"
          :disabled="signingIn"
          @click="handleSignIn"
          class="w-full rounded-lg py-2.5 text-sm font-medium transition-opacity disabled:opacity-50"
          style="background: var(--accent); color: #fff"
        >
          {{ signingIn ? 'Signing in…' : 'Continue with Google' }}
        </button>
        <p v-if="error" role="alert" class="mt-3 text-sm text-center" style="color: var(--negative)">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { signInWithGoogle } from '@/firebase/auth'

const router = useRouter()
const signingIn = ref(false)
const error = ref('')

async function handleSignIn() {
  signingIn.value = true
  error.value = ''
  try {
    await signInWithGoogle()
    router.replace('/')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Sign-in failed. Please try again.'
  } finally {
    signingIn.value = false
  }
}
</script>
