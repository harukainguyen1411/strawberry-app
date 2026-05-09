<template>
  <!-- Portfolio AppShell — sticky header + router-view slot -->
  <div class="min-h-screen" style="background: var(--bg); color: var(--text);">
    <!-- Header: sticky, 56px, Warm Night palette -->
    <header
      class="sticky top-0 z-50 h-14 px-4 flex items-center justify-between"
      style="background: var(--nav-bg); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-bottom: 1px solid var(--border);"
    >
      <!-- Left: menu icon (mobile only) + brand -->
      <div class="flex items-center gap-2">
        <!-- Menu icon — visible on mobile, hidden on desktop -->
        <button
          data-testid="menu-icon"
          class="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
          style="color: var(--muted);"
          aria-label="Open navigation menu"
          @click="$emit('menu')"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <!-- Brand -->
        <span class="text-base font-semibold tracking-wide" style="color: var(--text);">
          Strawberry&nbsp;·&nbsp;Portfolio
        </span>
      </div>

      <!-- Right: avatar + sign-out menu -->
      <div class="relative flex items-center gap-2">
        <!-- Avatar circle — 32px, initials fallback -->
        <button
          data-testid="avatar-btn"
          class="flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold uppercase tracking-wide select-none"
          style="background: var(--accent); color: var(--text);"
          :aria-label="`Account: ${email ?? 'signed out'}`"
          aria-haspopup="menu"
          :aria-expanded="showMenu"
          @click="toggleMenu"
        >
          {{ initials }}
        </button>

        <!-- Sign-out dropdown — anchored to avatar -->
        <div
          v-if="showMenu"
          data-testid="avatar-menu"
          role="menu"
          class="absolute right-0 top-10 w-56 rounded-lg py-1 z-50"
          style="background: var(--nav-bg); border: 1px solid var(--border); box-shadow: 0 8px 24px rgba(0,0,0,0.4);"
        >
          <!-- User email header -->
          <div class="px-4 py-3" style="border-bottom: 1px solid var(--border);">
            <p
              data-testid="avatar-menu-email"
              class="text-xs truncate"
              style="color: var(--muted);"
            >{{ email ?? '' }}</p>
          </div>

          <!-- Sign out button -->
          <button
            data-testid="sign-out-btn"
            role="menuitem"
            class="flex items-center gap-2 w-full text-left px-4 py-2 text-sm transition-colors"
            style="color: var(--text);"
            @click="handleSignOut"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </header>

    <!-- Main content -->
    <main>
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useAuthStore } from '@/stores/auth'

defineEmits<{
  menu: []
}>()

const router = useRouter()
const authStore = useAuthStore()
const { email } = useAuth()

/** Controls visibility of the avatar sign-out dropdown. */
const showMenu = ref(false)

/** Toggles the avatar sign-out dropdown open/closed. */
const toggleMenu = (): void => {
  showMenu.value = !showMenu.value
}

/**
 * Signs the user out and navigates to /sign-in.
 * Closes the menu first so it doesn't flash on the sign-in screen.
 * `router.push` is awaited so navigation rejections are not silently swallowed.
 */
const handleSignOut = async (): Promise<void> => {
  showMenu.value = false
  await authStore.signOut()
  await router.push('/sign-in')
}

/**
 * Derive 2-letter initials from email.
 * "duong@allowed.test" → "DA"
 * "jane.doe@example.com" → "JD"
 * Falls back to first 2 chars of email prefix if no dot/at.
 */
const initials = computed(() => {
  const e = email.value
  if (!e) return '?'
  // "duong@allowed.test" → local part "duong", domain "allowed.test"
  const [local, domain] = e.split('@')
  if (!domain) return local.slice(0, 2).toUpperCase()
  // First char of local part + first char of domain
  return (local[0] + domain[0]).toUpperCase()
})
</script>
