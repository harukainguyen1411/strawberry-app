<template>
  <div id="app" class="min-h-screen">
    <AppLayout>
      <router-view />
    </AppLayout>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import AppLayout from './components/layout/AppLayout.vue'
import { initRemoteConfigSignals } from '@/firebase/remoteConfigSignals'

// Initialize theme from localStorage — default dark
onMounted(() => {
  try {
    const saved = localStorage.getItem('ds-theme')
    const theme = saved === 'light' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', theme)
  } catch {
    document.documentElement.setAttribute('data-theme', 'dark')
  }

  // Initialize Remote Config custom signals (sets user identity for per-user flag targeting)
  initRemoteConfigSignals()
})
</script>
