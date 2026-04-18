<template>
  <button
    v-if="visible"
    @click.stop="handleFork"
    :disabled="forking"
    class="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg
           border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:border-blue-400/50
           transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
    :title="forking ? 'Forking...' : 'Create your own copy of this app'"
  >
    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round"
            d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
    </svg>
    {{ forking ? 'Forking...' : 'Fork' }}
  </button>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { forkApp } from '../../firebase/platformFirestore'

const props = defineProps<{
  appId: string
  appName: string
  forkable: boolean
}>()

const emit = defineEmits<{ forked: [forkedAppId: string] }>()

const router = useRouter()
const authStore = useAuthStore()
const forking = ref(false)
const error = ref('')

const visible = computed(() => {
  if (!props.forkable) return false
  if (!authStore.isAuthenticated || authStore.localMode) return false
  return true
})

async function handleFork() {
  const userId = authStore.user?.uid
  if (!userId || forking.value) return

  forking.value = true
  error.value = ''

  try {
    // Generate slug: source-app-id + userId fragment for uniqueness
    const slug = `${props.appId}-fork-${userId.substring(0, 6)}`
    const forkedAppId = await forkApp(props.appId, userId, slug)
    emit('forked', forkedAppId)
    router.push(`/yourApps/${forkedAppId}`)
  } catch (e: any) {
    if (e.message === 'app_not_forkable') {
      error.value = 'This app is not forkable.'
    } else {
      error.value = 'Failed to fork app.'
      console.error('Fork error:', e)
    }
  } finally {
    forking.value = false
  }
}
</script>
