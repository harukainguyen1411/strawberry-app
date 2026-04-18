<template>
  <div class="py-4 sm:py-6 lg:py-8">
    <!-- Loading -->
    <div v-if="loading" class="ds-glass p-8 text-center">
      <div class="w-6 h-6 rounded-full border-2 border-ds-border border-t-ds-accent animate-spin mx-auto mb-3"></div>
      <p class="text-ds-muted text-sm">Loading...</p>
    </div>

    <!-- Error: not found or collaboration not enabled -->
    <div v-else-if="error" class="ds-glass p-8 text-center">
      <p class="text-ds-muted">{{ error }}</p>
      <button class="ds-btn-primary text-sm py-2 px-4 rounded-lg mt-4" @click="router.push('/')">
        Back to Home
      </button>
    </div>

    <template v-else>
      <div class="mb-6">
        <button
          class="text-sm text-ds-muted hover:text-ds-text transition-colors mb-3 flex items-center gap-1"
          @click="router.back()"
        >
          <span>&larr;</span> Back
        </button>
        <div class="flex items-center gap-3 mb-2">
          <span class="text-2xl">{{ appRecord?.icon }}</span>
          <h1 class="font-display text-2xl sm:text-3xl font-semibold text-ds-text tracking-tight">
            {{ appRecord?.name }} — Suggestions
          </h1>
        </div>
        <p class="text-ds-muted text-sm">
          Share ideas for improving this app. The owner will review and respond.
        </p>
      </div>

      <AppSuggestions :app-id="appId" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAppRecord, type AppRecord } from '../firebase/platformFirestore'
import AppSuggestions from '../components/collaboration/AppSuggestions.vue'

const route = useRoute()
const router = useRouter()

const appId = route.params.appId as string
const loading = ref(true)
const error = ref<string | null>(null)
const appRecord = ref<AppRecord | null>(null)

onMounted(async () => {
  try {
    appRecord.value = await getAppRecord(appId)
    if (!appRecord.value) {
      error.value = 'App not found.'
    } else if (!appRecord.value.settings.collaboration) {
      error.value = 'Collaboration is not enabled for this app.'
    }
  } catch (e) {
    error.value = 'Failed to load app.'
  } finally {
    loading.value = false
  }
})
</script>
