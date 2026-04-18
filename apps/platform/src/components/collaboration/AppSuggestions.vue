<template>
  <div class="border-t border-ds-border/30 px-5 sm:px-6 py-4 bg-ds-surface/50">
    <h4 class="text-xs font-medium uppercase tracking-widest text-ds-muted mb-4">
      Suggestions
      <span v-if="suggestions.length > 0" class="text-ds-accent ml-1">({{ suggestions.length }})</span>
    </h4>

    <!-- Submit form -->
    <div v-if="canSubmit" class="mb-5">
      <div v-if="!showForm">
        <button
          class="ds-btn-primary text-sm py-2 px-4 rounded-lg"
          @click="showForm = true"
        >
          Suggest an improvement
        </button>
      </div>
      <div v-else class="ds-glass p-4 space-y-3">
        <input
          v-model="newTitle"
          type="text"
          placeholder="Suggestion title"
          class="w-full bg-ds-surface border border-ds-border/50 rounded-lg px-3 py-2 text-sm text-ds-text
                 placeholder:text-ds-muted/50 focus:outline-none focus:border-ds-accent/50"
        />
        <textarea
          v-model="newDescription"
          placeholder="Describe your suggestion..."
          rows="3"
          class="w-full bg-ds-surface border border-ds-border/50 rounded-lg px-3 py-2 text-sm text-ds-text
                 placeholder:text-ds-muted/50 focus:outline-none focus:border-ds-accent/50 resize-none"
        ></textarea>
        <div class="flex items-center gap-2">
          <button
            class="ds-btn-primary text-sm py-1.5 px-4 rounded-lg"
            :disabled="submitting || !newTitle.trim()"
            @click="handleSubmit"
          >
            {{ submitting ? 'Submitting...' : 'Submit' }}
          </button>
          <button
            class="text-sm text-ds-muted hover:text-ds-text transition-colors py-1.5 px-3"
            @click="showForm = false; newTitle = ''; newDescription = ''"
          >
            Cancel
          </button>
        </div>
        <p v-if="submitError" class="text-xs text-red-400">{{ submitError }}</p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-4">
      <div class="w-5 h-5 rounded-full border-2 border-ds-border border-t-ds-accent animate-spin mx-auto"></div>
    </div>

    <!-- Empty state -->
    <p v-else-if="suggestions.length === 0" class="text-sm text-ds-muted py-2">
      No suggestions yet.
    </p>

    <!-- Suggestion list -->
    <div v-else class="space-y-3">
      <div
        v-for="s in suggestions"
        :key="s.id"
        class="ds-glass p-4 rounded-xl"
      >
        <div class="flex items-start justify-between gap-3 mb-1.5">
          <h5 class="text-sm font-medium text-ds-text">{{ s.title }}</h5>
          <span
            class="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
            :class="statusBadgeClass(s.status)"
          >
            {{ s.status }}
          </span>
        </div>
        <p class="text-xs text-ds-muted mb-2 leading-relaxed">{{ s.description }}</p>
        <div class="flex items-center justify-between">
          <span class="text-[10px] text-ds-muted/60">
            by {{ s.authorName || 'Anonymous' }}
            <template v-if="s.createdAt">
              &middot; {{ formatDate(s.createdAt) }}
            </template>
          </span>

          <!-- Admin/owner actions -->
          <div v-if="isOwnerOrAdmin && s.status === 'open'" class="flex items-center gap-1.5">
            <button
              class="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              :disabled="responding === s.id"
              @click="handleAccept(s.id!)"
            >
              Accept
            </button>
            <button
              class="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
              :disabled="responding === s.id"
              @click="handleReject(s.id!)"
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import {
  getSuggestions,
  submitSuggestion,
  acceptSuggestion,
  rejectSuggestion,
  getAppRecord,
  type Suggestion
} from '../../firebase/platformFirestore'
import type { Timestamp } from 'firebase/firestore'

const props = defineProps<{
  appId: string
}>()

const authStore = useAuthStore()

const loading = ref(true)
const suggestions = ref<Suggestion[]>([])
const showForm = ref(false)
const newTitle = ref('')
const newDescription = ref('')
const submitting = ref(false)
const submitError = ref<string | null>(null)
const responding = ref<string | null>(null)
const appOwnerId = ref<string | null>(null)

const isOwnerOrAdmin = computed(() => {
  const uid = authStore.user?.uid
  if (!uid) return false
  if (authStore.user?.role === 'admin') return true
  return uid === appOwnerId.value
})

const canSubmit = computed(() => {
  return authStore.isAuthenticated
})

function statusBadgeClass(status: string) {
  switch (status) {
    case 'open': return 'bg-blue-500/10 text-blue-400'
    case 'accepted': return 'bg-emerald-500/10 text-emerald-400'
    case 'rejected': return 'bg-red-500/10 text-red-400'
    default: return 'bg-ds-border/30 text-ds-muted'
  }
}

function formatDate(ts: Timestamp) {
  if (!ts?.seconds) return ''
  return new Date(ts.seconds * 1000).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

async function handleSubmit() {
  const uid = authStore.user?.uid
  if (!uid || !newTitle.value.trim()) return

  submitting.value = true
  submitError.value = null

  try {
    await submitSuggestion(
      props.appId,
      uid,
      authStore.user?.displayName || 'Anonymous',
      newTitle.value.trim(),
      newDescription.value.trim()
    )
    showForm.value = false
    newTitle.value = ''
    newDescription.value = ''
    suggestions.value = await getSuggestions(props.appId)
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : 'Failed to submit suggestion'
  } finally {
    submitting.value = false
  }
}

async function handleAccept(suggestionId: string) {
  const uid = authStore.user?.uid
  if (!uid) return
  responding.value = suggestionId
  try {
    await acceptSuggestion(props.appId, suggestionId, uid)
    suggestions.value = await getSuggestions(props.appId)
  } finally {
    responding.value = null
  }
}

async function handleReject(suggestionId: string) {
  const uid = authStore.user?.uid
  if (!uid) return
  responding.value = suggestionId
  try {
    await rejectSuggestion(props.appId, suggestionId, uid)
    suggestions.value = await getSuggestions(props.appId)
  } finally {
    responding.value = null
  }
}

onMounted(async () => {
  try {
    const [suggestionsResult, appRecord] = await Promise.all([
      getSuggestions(props.appId),
      getAppRecord(props.appId)
    ])
    suggestions.value = suggestionsResult
    appOwnerId.value = appRecord?.ownerId ?? null
  } catch (e) {
    console.error('Failed to load suggestions:', e)
  } finally {
    loading.value = false
  }
})
</script>
