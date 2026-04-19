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

      <!-- Right: avatar -->
      <div class="flex items-center gap-2">
        <!-- Avatar circle — 32px, initials fallback -->
        <button
          class="flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold uppercase tracking-wide select-none"
          style="background: var(--accent); color: var(--text);"
          :aria-label="`Account: ${email ?? 'signed out'}`"
          @click="$emit('avatar-click')"
        >
          {{ initials }}
        </button>
      </div>
    </header>

    <!-- Main content -->
    <main>
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuth } from '@/composables/useAuth'

defineEmits<{
  menu: []
  'avatar-click': []
}>()

const { email } = useAuth()

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
