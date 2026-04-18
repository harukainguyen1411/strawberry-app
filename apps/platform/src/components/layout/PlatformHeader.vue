<template>
  <header class="sticky top-0 z-50 border-b border-ds-border/50"
          style="background: rgba(17,17,16,0.88); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);">
    <div class="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
      <div class="flex justify-between items-center h-14 sm:h-16">

        <!-- Wordmark / Logo -->
        <router-link to="/" class="flex items-center gap-2.5 group">
          <span class="relative flex items-center justify-center w-8 h-8">
            <!-- Strawberry SVG: unique IDs scoped to header to avoid gradient conflicts -->
            <svg viewBox="0 0 32 36" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-7 h-7">
              <defs>
                <linearGradient id="hdr-berry-fill" x1="6" y1="10" x2="26" y2="34" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#e85d42"/>
                  <stop offset="60%" stop-color="#c23a25"/>
                  <stop offset="100%" stop-color="#8a1f10"/>
                </linearGradient>
                <radialGradient id="hdr-berry-shine" cx="38%" cy="28%" r="42%">
                  <stop offset="0%" stop-color="#ffffff" stop-opacity="0.22"/>
                  <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
                </radialGradient>
              </defs>
              <!-- Leaves -->
              <path d="M16,10 C14,6 10,5 9,7 C10,9 13,10 16,10 Z" fill="#3a8a30"/>
              <path d="M16,10 C18,6 22,5 23,7 C22,9 19,10 16,10 Z" fill="#4aa040"/>
              <path d="M16,10 C16,6 16,4 16,3 C15,5 14,8 16,10 Z" fill="#2d7025"/>
              <!-- Berry body -->
              <path d="M16,10 C8,10 5,16 5,22 C5,28 9,34 16,34 C23,34 27,28 27,22 C27,16 24,10 16,10 Z"
                    fill="url(#hdr-berry-fill)"/>
              <!-- Shine overlay -->
              <path d="M16,10 C8,10 5,16 5,22 C5,28 9,34 16,34 C23,34 27,28 27,22 C27,16 24,10 16,10 Z"
                    fill="url(#hdr-berry-shine)"/>
              <!-- Seeds -->
              <ellipse cx="13" cy="19" rx="1" ry="1.3" fill="rgba(255,255,255,0.25)" transform="rotate(-10,13,19)"/>
              <ellipse cx="19" cy="18" rx="1" ry="1.3" fill="rgba(255,255,255,0.25)" transform="rotate(10,19,18)"/>
              <ellipse cx="12" cy="25" rx="1" ry="1.3" fill="rgba(255,255,255,0.25)" transform="rotate(-5,12,25)"/>
              <ellipse cx="20" cy="25" rx="1" ry="1.3" fill="rgba(255,255,255,0.25)" transform="rotate(5,20,25)"/>
              <ellipse cx="16" cy="29" rx="1" ry="1.3" fill="rgba(255,255,255,0.20)"/>
            </svg>
            <span class="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style="box-shadow: 0 0 14px rgba(232,97,74,0.5); border-radius: 50%;"></span>
          </span>
          <span class="font-display text-lg sm:text-xl font-semibold tracking-wide text-ds-text
                       group-hover:text-ds-accent transition-[color] duration-200 ease-out">
            Dark<span class="text-ds-accent">Strawberry</span>
          </span>
        </router-link>

        <!-- Nav right -->
        <nav class="flex items-center gap-2 sm:gap-3">
          <router-link
            to="/"
            class="text-sm font-medium text-ds-muted hover:text-ds-text transition-colors px-2 py-1 rounded-lg
                   hover:bg-ds-surface-hi/50"
            active-class="text-ds-text"
          >
            <span class="hidden sm:inline">{{ $t('common.home') }}</span>
            <span class="sm:hidden"><DsIcon name="home" :size="18" /></span>
          </router-link>

          <router-link
            v-if="authStore.isAuthenticated"
            to="/your-apps"
            class="text-sm font-medium text-ds-muted hover:text-ds-text transition-colors px-2 py-1 rounded-lg
                   hover:bg-ds-surface-hi/50"
            active-class="text-ds-text"
          >
            Your Apps
          </router-link>

          <LanguageSelector />

          <div v-if="authStore.loading" class="px-2">
            <div class="w-4 h-4 rounded-full border-2 border-ds-border border-t-ds-accent animate-spin"></div>
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
import { useAuthStore } from '@/stores/auth'
import { DsIcon } from '@shared/ui/icons'
import GoogleLoginButton from '@/components/auth/GoogleLoginButton.vue'
import UserProfile from '@/components/auth/UserProfile.vue'
import LocalModeProfile from '@/components/auth/LocalModeProfile.vue'
import LanguageSelector from '@/components/common/LanguageSelector.vue'

const authStore = useAuthStore()
</script>
