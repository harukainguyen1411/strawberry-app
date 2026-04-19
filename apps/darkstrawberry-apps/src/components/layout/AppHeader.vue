<template>
  <header class="sticky top-0 z-50" style="background: var(--nav-bg); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-bottom: 1px solid var(--border);">
    <div class="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
      <div class="flex justify-between items-center h-14 sm:h-16">

        <!-- Wordmark / Logo -->
        <router-link to="/" class="flex items-center gap-2.5 group" aria-label="Dark Strawberry home">
          <!-- DS strawberry jewel mark -->
          <span class="relative flex items-center justify-center w-8 h-8">
            <svg viewBox="0 0 32 34" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-8 h-8">
              <defs>
                <linearGradient id="ds-logo-fill" x1="4" y1="4" x2="28" y2="30" gradientUnits="userSpaceOnUse">
                  <stop offset="0%"   stop-color="#c94a35"/>
                  <stop offset="50%"  stop-color="#9b3a2a"/>
                  <stop offset="100%" stop-color="#6b2518"/>
                </linearGradient>
                <radialGradient id="ds-logo-sheen" cx="38%" cy="32%" r="52%">
                  <stop offset="0%"   stop-color="#f5a623" stop-opacity="0.55"/>
                  <stop offset="100%" stop-color="#9b3a2a" stop-opacity="0"/>
                </radialGradient>
              </defs>
              <!-- Leaf stem — sits above the body, within viewBox -->
              <path d="M13,5 Q16,2 19,5" stroke="#4a9040" stroke-width="1.8" fill="none" stroke-linecap="round"/>
              <!-- Faceted body -->
              <polygon points="16,5 26,10 28,20 22,30 10,30 4,20 6,10"
                       fill="url(#ds-logo-fill)" stroke="rgba(204,46,46,0.35)" stroke-width="0.5"/>
              <!-- Inner sheen -->
              <polygon points="16,9 23,13 24,21 19,27 13,27 8,21 9,13"
                       fill="url(#ds-logo-sheen)" opacity="0.65"/>
              <!-- Highlight facet edge -->
              <path d="M16,9 L9,13" stroke="rgba(255,255,255,0.18)" stroke-width="0.8"/>
              <path d="M16,9 L23,13" stroke="rgba(255,255,255,0.08)" stroke-width="0.5"/>
            </svg>
            <span class="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style="box-shadow: 0 0 14px rgba(204,46,46,0.5);"></span>
          </span>

          <!-- Wordmark: "Dark Strawberry" / "White Strawberry" -->
          <span class="font-display text-lg sm:text-xl font-semibold tracking-wide transition-colors duration-200"
                style="color: var(--text);">
            <span class="brand-adj" style="color: var(--text);">{{ brandAdj }}</span><span style="color: var(--accent);">Strawberry</span>
          </span>
        </router-link>

        <!-- Nav right -->
        <nav class="flex items-center gap-1.5 sm:gap-2">

          <!-- Home link (hidden on home route) -->
          <router-link
            to="/"
            class="hidden sm:flex items-center gap-1.5 text-sm font-medium px-2.5 py-1.5 rounded-lg transition-colors duration-150"
            style="color: var(--muted);"
            active-class="ds-nav-active"
          >
            <!-- DS home icon -->
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            {{ $t('common.home') }}
          </router-link>

          <!-- Theme toggle -->
          <button class="ds-theme-toggle" @click="toggleTheme" :aria-label="`Switch to ${isDark ? 'light' : 'dark'} mode`">
            <!-- Sun (shown in dark mode → click to go light) -->
            <svg v-if="isDark" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="4"/>
              <line x1="12" y1="2" x2="12" y2="4"/>
              <line x1="12" y1="20" x2="12" y2="22"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="2" y1="12" x2="4" y2="12"/>
              <line x1="20" y1="12" x2="22" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
            <!-- Moon (shown in light mode → click to go dark) -->
            <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
            <span class="hidden sm:inline">{{ isDark ? 'Light mode' : 'Dark mode' }}</span>
          </button>

          <LanguageSelector />

          <div v-if="authStore.loading" class="px-2">
            <div class="w-4 h-4 rounded-full border-2 animate-spin" style="border-color: var(--border); border-top-color: var(--accent);"></div>
          </div>
          <GoogleLoginButton v-else-if="!authStore.isAuthenticated && !authStore.localMode" />
          <LocalModeProfile v-else-if="authStore.localMode || authStore.syncingFromLocal" />
          <UserProfile v-else-if="authStore.user && !authStore.syncingFromLocal" />
        </nav>

      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import GoogleLoginButton from '@/components/auth/GoogleLoginButton.vue'
import UserProfile from '@/components/auth/UserProfile.vue'
import LocalModeProfile from '@/components/auth/LocalModeProfile.vue'
import LanguageSelector from '@/components/common/LanguageSelector.vue'

const authStore = useAuthStore()

const theme = ref<'dark' | 'light'>('dark')
const isDark = computed(() => theme.value === 'dark')
const brandAdj = computed(() => isDark.value ? 'Dark' : 'White')

function applyTheme(t: 'dark' | 'light') {
  theme.value = t
  document.documentElement.setAttribute('data-theme', t)
  try { localStorage.setItem('ds-theme', t) } catch {}
}

function toggleTheme() {
  applyTheme(isDark.value ? 'light' : 'dark')
}

onMounted(() => {
  try {
    const saved = localStorage.getItem('ds-theme')
    const resolved = saved === 'light' ? 'light' : 'dark'
    theme.value = resolved
    document.documentElement.setAttribute('data-theme', resolved)
  } catch {
    theme.value = 'dark'
    document.documentElement.setAttribute('data-theme', 'dark')
  }
})
</script>

<style scoped>
.ds-nav-active {
  color: var(--text) !important;
}
</style>
