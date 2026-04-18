<template>
  <div class="min-h-screen flex items-center justify-center" style="background: var(--bg)">
    <div class="text-center">
      <p v-if="error" class="text-sm" style="color: var(--accent)">{{ error }}</p>
      <p v-else class="text-sm" style="color: var(--muted)">Signing you in…</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { completeSignIn } from '@/auth/emailLink'

const router = useRouter()
const error = ref('')

onMounted(async () => {
  try {
    await completeSignIn(window.location.href)
    router.replace('/')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Sign-in failed. Please try again.'
  }
})
</script>
