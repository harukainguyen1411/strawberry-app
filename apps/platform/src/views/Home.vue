<template>
  <div class="py-4 sm:py-6 lg:py-8">

    <!-- Header area -->
    <div class="text-center mb-10 sm:mb-14 relative">
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

    <!-- Sign-in CTA -->
    <div v-else-if="!authStore.isAuthenticated && !authStore.localMode"
         class="ds-glass p-6 sm:p-8 mb-8 sm:mb-12 max-w-lg mx-auto text-center">
      <div class="mb-3 text-ds-accent flex justify-center"><DsIcon name="strawberry" :size="36" /></div>
      <p class="text-ds-text font-medium mb-1">Sign in to sync your data</p>
      <p class="text-ds-muted text-sm mb-4">Your apps, your progress — anywhere you are.</p>
      <GoogleLoginButton />
    </div>

    <!-- Admin: seed registry -->
    <div v-if="isAdmin && needsSeed && !authStore.loading"
         class="ds-glass p-4 mb-6 max-w-lg mx-auto text-center">
      <p class="text-sm text-ds-muted mb-2">App registry not seeded in Firestore yet.</p>
      <button
        class="ds-btn-primary text-sm py-2 px-4 rounded-lg"
        :disabled="seeding"
        @click="handleSeedRegistry"
      >
        {{ seeding ? 'Seeding...' : 'Seed App Registry' }}
      </button>
    </div>

    <!-- My Apps section -->
    <template v-if="!authStore.loading">
      <div class="flex items-center gap-3 mb-5 sm:mb-6">
        <span class="text-xs font-medium uppercase tracking-widest text-ds-muted">My Apps</span>
        <div class="flex-1 h-px bg-ds-border/40"></div>
        <span class="text-xs text-ds-muted/60">{{ myApps.length }} available</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-10">
        <div
          v-for="(app, index) in myApps"
          :key="app.id"
          class="ds-glass group cursor-pointer transition-[box-shadow,border-color,transform] duration-300 ease-out touch-manipulation overflow-hidden relative"
          :style="{ animationDelay: `${index * 80}ms` }"
          @click="router.push(`/myApps/${app.id}`)"
        >
          <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none rounded-2xl"
               style="background: radial-gradient(ellipse at 30% 40%, rgba(232,97,74,0.08) 0%, transparent 70%);"></div>
          <div class="relative p-5 sm:p-6">
            <div class="mb-4 inline-block text-ds-accent group-hover:animate-float transition-all">
              <DsIcon :name="app.icon" :size="44" />
            </div>
            <h2 class="font-display text-xl sm:text-2xl font-semibold text-ds-text mb-1.5 tracking-tight
                       group-hover:text-ds-accent transition-[color] duration-200 ease-out">
              {{ app.name }}
            </h2>
            <p class="text-sm sm:text-base text-ds-muted mb-3 leading-relaxed">
              {{ app.description }}
            </p>
            <div v-if="entryFor(app.id)" class="flex flex-wrap gap-1.5 mb-4">
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-ds-accent/10 text-ds-accent font-medium">
                v{{ entryFor(app.id)!.version }}
              </span>
              <span v-if="entryFor(app.id)!.access.public"
                    class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">
                Public
              </span>
              <span v-if="entryFor(app.id)!.settings.forkable"
                    class="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-medium">
                Forkable
              </span>
              <ForkButton
                v-if="entryFor(app.id)!.settings.forkable"
                :app-id="app.id"
                :app-name="app.name"
                :forkable="true"
              />
              <span v-if="entryFor(app.id)!.settings.collaboration"
                    class="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-medium cursor-pointer hover:bg-purple-500/30 transition-colors"
                    @click.stop="router.push(`/apps/${app.id}/suggestions`)">
                Suggest
              </span>
            </div>
            <button class="w-full ds-btn-primary text-sm sm:text-base py-2.5 rounded-xl font-medium
                         flex items-center justify-center gap-2">
              Open
              <span class="opacity-70 group-hover:translate-x-0.5 transition-transform duration-200">&rarr;</span>
            </button>
          </div>
          <div class="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-ds-accent/50 to-transparent
                      scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-center"></div>
        </div>
      </div>

      <!-- Your Apps section (only shown when authenticated) -->
      <template v-if="authStore.isAuthenticated && yourApps.length > 0">
        <div class="flex items-center gap-3 mb-5 sm:mb-6">
          <span class="text-xs font-medium uppercase tracking-widest text-ds-muted">Your Apps</span>
          <div class="flex-1 h-px bg-ds-border/40"></div>
          <span class="text-xs text-ds-muted/60">{{ yourApps.length }} available</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          <div
            v-for="(app, index) in yourApps"
            :key="app.id"
            class="ds-glass group cursor-pointer transition-[box-shadow,border-color,transform] duration-300 ease-out touch-manipulation overflow-hidden relative"
            :style="{ animationDelay: `${index * 80}ms` }"
            @click="router.push(`/yourApps/${app.id}`)"
          >
            <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none rounded-2xl"
                 style="background: radial-gradient(ellipse at 30% 40%, rgba(232,97,74,0.08) 0%, transparent 70%);"></div>
            <div class="relative p-5 sm:p-6">
              <div class="text-4xl sm:text-5xl mb-4 inline-block group-hover:animate-float transition-all">
                {{ app.icon }}
              </div>
              <h2 class="font-display text-xl sm:text-2xl font-semibold text-ds-text mb-1.5 tracking-tight
                         group-hover:text-ds-accent transition-[color] duration-200 ease-out">
                {{ app.name }}
              </h2>
              <p class="text-sm sm:text-base text-ds-muted mb-3 leading-relaxed">
                {{ app.description }}
              </p>
              <div v-if="entryFor(app.id)" class="flex flex-wrap gap-1.5 mb-4">
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-ds-accent/10 text-ds-accent font-medium">
                  v{{ entryFor(app.id)!.version }}
                </span>
                <span v-if="entryFor(app.id)!.settings.personalMode"
                      class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-medium">
                  Personal
                </span>
                <span v-if="entryFor(app.id)!.settings.collaboration"
                      class="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-medium">
                  Collab
                </span>
              </div>
              <button class="w-full ds-btn-primary text-sm sm:text-base py-2.5 rounded-xl font-medium
                           flex items-center justify-center gap-2">
                Open
                <span class="opacity-70 group-hover:translate-x-0.5 transition-transform duration-200">&rarr;</span>
              </button>
            </div>
            <div class="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-ds-accent/50 to-transparent
                        scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-center"></div>
          </div>
        </div>
      </template>
    </template>

  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { loadRegistry, getRegistry, getRegistryEntries, getRegistryEntry, seedRegistry } from '../registry/appRegistry'
import type { AppManifest } from '@shared/types/AppManifest'
import type { AppRegistryEntry } from '../registry/firestoreRegistry'
import { DsIcon } from '@shared/ui/icons'
import GoogleLoginButton from '@/components/auth/GoogleLoginButton.vue'
import ForkButton from '../components/fork/ForkButton.vue'

const router = useRouter()
const authStore = useAuthStore()

const apps = ref<AppManifest[]>([])
const registryLoaded = ref(false)
const seeding = ref(false)

onMounted(async () => {
  const registry = getRegistry()
  if (registry.length > 0) {
    apps.value = registry
    registryLoaded.value = getRegistryEntries().length > 0
  } else {
    apps.value = await loadRegistry()
    registryLoaded.value = getRegistryEntries().length > 0
  }
})

const myApps = computed(() => apps.value.filter(a => a.category === 'myApps'))
const yourApps = computed(() => apps.value.filter(a => a.category === 'yourApps'))

function entryFor(appId: string): AppRegistryEntry | undefined {
  return getRegistryEntry(appId)
}

const isAdmin = computed(() => authStore.user?.role === 'admin')
const needsSeed = computed(() => registryLoaded.value === false && apps.value.length > 0)

async function handleSeedRegistry() {
  if (!authStore.user?.uid) return
  seeding.value = true
  try {
    await seedRegistry(authStore.user.uid)
    registryLoaded.value = true
  } finally {
    seeding.value = false
  }
}
</script>
