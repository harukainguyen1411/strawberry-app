<template>
  <div class="py-4 sm:py-6 lg:py-8">

    <!-- Header area -->
    <div class="text-center mb-10 sm:mb-14 relative">
      <!-- Ambient glow behind headline -->
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
        <div class="w-72 h-24 rounded-full opacity-20 blur-3xl"
             style="background: radial-gradient(ellipse, rgba(232,97,74,0.5), transparent);"></div>
      </div>
      <h1 class="relative font-display text-3xl sm:text-4xl md:text-5xl font-semibold text-ds-text mb-3 tracking-tight">
        {{ $t('app.welcome') }}
      </h1>
      <p class="relative text-base sm:text-lg text-ds-muted max-w-md mx-auto leading-relaxed">
        {{ $t('app.subtitle') }}
      </p>
    </div>

    <!-- Loading state -->
    <div v-if="authStore.loading" class="mb-8 sm:mb-12">
      <div class="max-w-2xl mx-auto text-center">
        <div class="w-7 h-7 rounded-full border-2 border-ds-border border-t-ds-accent animate-spin mx-auto mb-4"></div>
        <p class="text-sm text-ds-muted">{{ $t('common.loading') }}</p>
      </div>
    </div>

    <!-- Sign-in CTA (logged out, non-local mode) -->
    <div v-else-if="!authStore.isAuthenticated && !authStore.localMode"
         class="ds-glass p-6 sm:p-8 mb-8 sm:mb-12 max-w-lg mx-auto text-center">
      <div class="text-3xl mb-3">✦</div>
      <p class="text-ds-text font-medium mb-1">Sign in to sync your data</p>
      <p class="text-ds-muted text-sm mb-4">Your apps, your progress — anywhere you are.</p>
      <GoogleLoginButton />
    </div>

    <!-- Section label -->
    <div class="flex items-center gap-3 mb-5 sm:mb-6" v-if="!authStore.loading">
      <span class="text-xs font-medium uppercase tracking-widest text-ds-muted">Your Apps</span>
      <div class="flex-1 h-px bg-ds-border/40"></div>
      <span class="text-xs text-ds-muted/60">{{ apps.length }} available</span>
    </div>

    <!-- App cards grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
      <div
        v-for="(app, index) in apps"
        :key="app.id"
        class="ds-glass group cursor-pointer transition-all duration-300 touch-manipulation overflow-hidden relative"
        :style="{ animationDelay: `${index * 80}ms` }"
        @click="navigateToApp(app.route)"
      >
        <!-- Hover glow layer -->
        <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none rounded-2xl"
             style="background: radial-gradient(ellipse at 30% 40%, rgba(232,97,74,0.08) 0%, transparent 70%);"></div>

        <div class="relative p-5 sm:p-6">
          <!-- Icon with floating animation on hover -->
          <div class="text-4xl sm:text-5xl mb-4 inline-block group-hover:animate-float transition-all">
            {{ app.icon }}
          </div>

          <!-- App name -->
          <h2 class="font-display text-xl sm:text-2xl font-semibold text-ds-text mb-1.5 tracking-tight
                     group-hover:text-ds-accent transition-colors duration-200">
            {{ app.name }}
          </h2>

          <!-- Description -->
          <p class="text-sm sm:text-base text-ds-muted mb-5 leading-relaxed">
            {{ app.description }}
          </p>

          <!-- Open button -->
          <button
            class="w-full ds-btn-primary text-sm sm:text-base py-2.5 rounded-xl font-medium
                   flex items-center justify-center gap-2"
          >
            {{ $t('home.readTracker.openApp') }}
            <span class="opacity-70 group-hover:translate-x-0.5 transition-transform duration-200">→</span>
          </button>
        </div>

        <!-- Bottom accent line — visible on hover -->
        <div class="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-ds-accent/50 to-transparent
                    scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-center"></div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import GoogleLoginButton from '@/components/auth/GoogleLoginButton.vue'
import { useFeatureFlag } from '@/composables/useFeatureFlag'

interface App {
  id: string
  name: string
  description: string
  icon: string
  route: string
  flag?: string  // Remote Config key — omit for always-visible apps
}

const router = useRouter()
const authStore = useAuthStore()

const { t } = useI18n()

const allApps = ref<App[]>([
  {
    id: 'read-tracker',
    name: t('home.readTracker.name'),
    description: t('home.readTracker.description'),
    icon: '📚',
    route: '/myApps/read-tracker'
  },
  {
    id: 'portfolio-tracker',
    name: t('home.portfolioTracker.name'),
    description: t('home.portfolioTracker.description'),
    icon: '📈',
    route: '/myApps/portfolio-tracker'
  },
  {
    id: 'task-list',
    name: t('home.taskList.name'),
    description: t('home.taskList.description'),
    icon: '📋',
    route: '/myApps/task-list'
  },
  {
    id: 'bee',
    name: t('home.bee.name'),
    description: t('home.bee.description'),
    icon: '🐝',
    route: '/yourApps/bee',
    flag: 'bee_visible'
  }
])

// Resolve flags — build a map of flag key → reactive boolean
const flagKeys = allApps.value
  .map((a) => a.flag)
  .filter((f): f is string => !!f)
const flags = Object.fromEntries(
  flagKeys.map((key) => [key, useFeatureFlag(key)])
)

// Per-user app allowlist — keyed by app id, value is set of allowed emails.
// Used in addition to Remote Config flags so per-user visibility works without
// the firebase@11 setCustomSignals upgrade.
const APP_EMAIL_ALLOWLIST: Record<string, string[]> = {
  bee: ['harukainguyen1411@gmail.com']
}

const apps = computed(() =>
  allApps.value.filter((app) => {
    const allowedEmails = APP_EMAIL_ALLOWLIST[app.id]
    if (allowedEmails) {
      return !!authStore.user?.email && allowedEmails.includes(authStore.user.email)
    }
    if (!app.flag) return true
    return flags[app.flag]?.value ?? false
  })
)

const navigateToApp = (route: string): void => {
  router.push(route)
}
</script>
