<template>
  <div class="py-4 sm:py-6 lg:py-8">
    <div class="mb-8">
      <h1 class="font-display text-2xl sm:text-3xl font-semibold text-ds-text mb-2 tracking-tight">
        Your Apps
      </h1>
      <p class="text-ds-muted text-sm sm:text-base">
        Apps you own or have been granted access to.
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="ds-glass p-8 text-center">
      <div class="w-6 h-6 rounded-full border-2 border-ds-border border-t-ds-accent animate-spin mx-auto mb-3"></div>
      <p class="text-ds-muted text-sm">Loading your apps...</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="ownedApps.length === 0 && grantedApps.length === 0" class="ds-glass p-8 text-center">
      <p class="text-ds-muted">No apps yet. Apps built for you will appear here.</p>
    </div>

    <template v-else>
      <!-- Owned Apps -->
      <template v-if="ownedApps.length > 0">
        <div class="flex items-center gap-3 mb-5">
          <span class="text-xs font-medium uppercase tracking-widest text-ds-muted">Owned by You</span>
          <div class="flex-1 h-px bg-ds-border/40"></div>
        </div>

        <div class="space-y-4 mb-10">
          <div v-for="app in ownedApps" :key="app.id" class="ds-glass overflow-hidden">
            <!-- App header -->
            <div class="p-5 sm:p-6 flex items-start justify-between gap-4">
              <div class="flex items-center gap-4 cursor-pointer flex-1 min-w-0"
                   @click="router.push(`/yourApps/${app.id}`)">
                <span class="text-3xl flex-shrink-0">{{ app.icon }}</span>
                <div class="min-w-0">
                  <h3 class="font-display text-lg font-semibold text-ds-text truncate
                             hover:text-ds-accent transition-colors">
                    {{ app.name }}
                  </h3>
                  <p class="text-sm text-ds-muted truncate">{{ app.description }}</p>
                  <ForkBadge :app-id="app.id!" />
                </div>
              </div>
              <button
                @click="toggleSettings(app.id!)"
                class="text-ds-muted hover:text-ds-text transition-colors p-1.5 rounded-lg hover:bg-ds-surface-hi/50 flex-shrink-0"
                :title="expandedApp === app.id ? 'Hide settings' : 'Show settings'"
              >
                <svg class="w-5 h-5 transition-transform duration-200"
                     :class="{ 'rotate-180': expandedApp === app.id }"
                     fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            <!-- Settings panel (expandable) -->
            <div v-if="expandedApp === app.id"
                 class="border-t border-ds-border/30 px-5 sm:px-6 py-4 bg-ds-surface/50 space-y-4">
              <h4 class="text-xs font-medium uppercase tracking-widest text-ds-muted mb-3">App Settings</h4>

              <label class="flex items-center justify-between cursor-pointer">
                <div>
                  <span class="text-sm text-ds-text font-medium">Collaboration</span>
                  <p class="text-xs text-ds-muted">Allow collaborators to suggest improvements</p>
                </div>
                <ToggleSwitch
                  :model-value="appSettings[app.id!]?.collaboration ?? false"
                  @update:model-value="saveSetting(app.id!, 'collaboration', $event)"
                />
              </label>

              <label class="flex items-center justify-between cursor-pointer">
                <div>
                  <span class="text-sm text-ds-text font-medium">Forkable</span>
                  <p class="text-xs text-ds-muted">Allow eligible users to fork this app</p>
                </div>
                <ToggleSwitch
                  :model-value="appSettings[app.id!]?.forkable ?? false"
                  @update:model-value="saveSetting(app.id!, 'forkable', $event)"
                />
              </label>

              <label class="flex items-center justify-between cursor-pointer">
                <div>
                  <span class="text-sm text-ds-text font-medium">Personal Mode</span>
                  <p class="text-xs text-ds-muted">Admin can only fix bugs — you control feature direction</p>
                </div>
                <ToggleSwitch
                  :model-value="appSettings[app.id!]?.personalMode ?? false"
                  @update:model-value="saveSetting(app.id!, 'personalMode', $event)"
                />
              </label>

              <p v-if="savingApp === app.id" class="text-xs text-ds-accent">Saving...</p>
            </div>

            <!-- Access requests panel -->
            <AccessRequestsPanel
              v-if="expandedApp === app.id && app.id"
              :app-id="app.id"
              :responder-id="authStore.user?.uid ?? ''"
            />

            <!-- Suggestions panel (only for collab-enabled apps) -->
            <AppSuggestions
              v-if="expandedApp === app.id && app.id && appSettings[app.id]?.collaboration"
              :app-id="app.id"
            />
          </div>
        </div>
      </template>

      <!-- Granted Apps -->
      <template v-if="grantedApps.length > 0">
        <div class="flex items-center gap-3 mb-5">
          <span class="text-xs font-medium uppercase tracking-widest text-ds-muted">Granted Access</span>
          <div class="flex-1 h-px bg-ds-border/40"></div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          <div
            v-for="app in grantedApps"
            :key="app.id"
            class="ds-glass group cursor-pointer transition-all duration-300 overflow-hidden relative"
            @click="router.push(`/${app.category}/${app.id}`)"
          >
            <div class="p-5 sm:p-6">
              <div class="mb-3 text-ds-accent"><DsIcon :name="app.icon" :size="32" /></div>
              <h3 class="font-display text-lg font-semibold text-ds-text mb-1
                         group-hover:text-ds-accent transition-[color] duration-200 ease-out">
                {{ app.name }}
              </h3>
              <p class="text-sm text-ds-muted">{{ app.description }}</p>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { DsIcon } from '@shared/ui/icons'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  getUserAppAccess,
  getAppRecord,
  updateAppSettings,
  type AppRecord,
  type AppAccess
} from '../firebase/platformFirestore'
import ToggleSwitch from '../components/ui/ToggleSwitch.vue'
import ForkBadge from '../components/fork/ForkBadge.vue'
import AccessRequestsPanel from '../components/access/AccessRequestsPanel.vue'
import AppSuggestions from '../components/collaboration/AppSuggestions.vue'

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const expandedApp = ref<string | null>(null)
const savingApp = ref<string | null>(null)
const allApps = ref<AppRecord[]>([])
const accessEntries = ref<Array<{ appId: string } & AppAccess>>([])
const appSettings = ref<Record<string, { collaboration: boolean; forkable: boolean; personalMode: boolean }>>({})

const ownedApps = computed(() =>
  allApps.value.filter(app =>
    accessEntries.value.some(a => a.appId === app.id && (a.role === 'owner' || a.role === 'fork-owner'))
  )
)

const grantedApps = computed(() =>
  allApps.value.filter(app =>
    accessEntries.value.some(a => a.appId === app.id && a.role === 'user')
  )
)

function toggleSettings(appId: string) {
  expandedApp.value = expandedApp.value === appId ? null : appId
}

async function saveSetting(appId: string, key: 'collaboration' | 'forkable' | 'personalMode', value: boolean) {
  if (!appSettings.value[appId]) return
  appSettings.value[appId][key] = value
  savingApp.value = appId
  try {
    await updateAppSettings(appId, { [key]: value })
  } catch (e) {
    console.error('Failed to update app setting:', e)
    appSettings.value[appId][key] = !value
  } finally {
    savingApp.value = null
  }
}

onMounted(async () => {
  const userId = authStore.user?.uid
  if (!userId) {
    loading.value = false
    return
  }

  try {
    accessEntries.value = await getUserAppAccess(userId)
    const results = await Promise.all(
      accessEntries.value.map(a => getAppRecord(a.appId))
    )
    allApps.value = results.filter((a): a is AppRecord => a !== null)

    for (const app of allApps.value) {
      if (app.settings) {
        appSettings.value[app.id!] = { ...app.settings }
      }
    }
  } catch (e) {
    console.error('Failed to load apps:', e)
  } finally {
    loading.value = false
  }
})
</script>
