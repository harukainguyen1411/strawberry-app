<template>
  <div class="border-t border-ds-border/30 px-5 sm:px-6 py-4 bg-ds-surface/50">
    <h4 class="text-xs font-medium uppercase tracking-widest text-ds-muted mb-4">Access Requests</h4>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center gap-2 text-ds-muted text-sm py-2">
      <div class="w-4 h-4 rounded-full border-2 border-ds-border border-t-ds-accent animate-spin"></div>
      Loading requests...
    </div>

    <!-- Empty -->
    <p v-else-if="requests.length === 0" class="text-ds-muted text-sm">
      No pending access requests.
    </p>

    <!-- Request list -->
    <div v-else class="space-y-3">
      <div
        v-for="req in requests"
        :key="req.id"
        class="flex items-center justify-between gap-3 p-3 rounded-xl bg-ds-surface border border-ds-border/30"
      >
        <div class="min-w-0">
          <p class="text-sm text-ds-text font-medium truncate">{{ req.requesterId }}</p>
          <p class="text-xs text-ds-muted">
            {{ formatDate(req.createdAt) }}
            <span
              class="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium"
              :class="{
                'bg-amber-500/10 text-amber-400': req.status === 'pending',
                'bg-emerald-500/10 text-emerald-400': req.status === 'approved',
                'bg-red-500/10 text-red-400': req.status === 'denied'
              }"
            >
              {{ req.status }}
            </span>
          </p>
        </div>

        <div v-if="req.status === 'pending'" class="flex gap-2 flex-shrink-0">
          <button
            class="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400
                   hover:bg-emerald-500/20 transition-colors font-medium"
            :disabled="respondingTo === req.id"
            @click="handleApprove(req)"
          >
            Approve
          </button>
          <button
            class="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400
                   hover:bg-red-500/20 transition-colors font-medium"
            :disabled="respondingTo === req.id"
            @click="handleDeny(req)"
          >
            Deny
          </button>
        </div>
      </div>
    </div>

    <p v-if="actionError" class="text-red-400 text-xs mt-3">{{ actionError }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  getPendingAccessRequests,
  getAccessRequests,
  approveAccessRequest,
  denyAccessRequest,
  type AccessRequest
} from '../../firebase/platformFirestore'
import type { Timestamp } from 'firebase/firestore'

const props = defineProps<{
  appId: string
  responderId: string
  showAll?: boolean  // if true, show all statuses; otherwise pending only
}>()

const loading = ref(true)
const requests = ref<AccessRequest[]>([])
const respondingTo = ref<string | null>(null)
const actionError = ref<string | null>(null)

onMounted(async () => {
  try {
    requests.value = props.showAll
      ? await getAccessRequests(props.appId)
      : await getPendingAccessRequests(props.appId)
  } finally {
    loading.value = false
  }
})

function formatDate(ts: Timestamp | undefined): string {
  if (!ts) return ''
  return ts.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

async function handleApprove(req: AccessRequest) {
  if (!req.id) return
  respondingTo.value = req.id
  actionError.value = null
  try {
    await approveAccessRequest(props.appId, req.id, req.requesterId, props.responderId)
    req.status = 'approved'
  } catch {
    actionError.value = 'Failed to approve. Please try again.'
  } finally {
    respondingTo.value = null
  }
}

async function handleDeny(req: AccessRequest) {
  if (!req.id) return
  respondingTo.value = req.id
  actionError.value = null
  try {
    await denyAccessRequest(props.appId, req.id, props.responderId)
    req.status = 'denied'
  } catch {
    actionError.value = 'Failed to deny. Please try again.'
  } finally {
    respondingTo.value = null
  }
}
</script>
