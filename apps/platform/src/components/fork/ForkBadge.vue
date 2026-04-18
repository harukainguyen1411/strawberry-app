<template>
  <div v-if="sourceApp" class="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded
                                bg-blue-500/10 text-blue-400 font-medium">
    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round"
            d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
    </svg>
    Forked from {{ sourceApp.name }}
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getForkSource, getAppRecord, type AppRecord } from '../../firebase/platformFirestore'

const props = defineProps<{ appId: string }>()

const sourceApp = ref<AppRecord | null>(null)

onMounted(async () => {
  try {
    const fork = await getForkSource(props.appId)
    if (fork) {
      sourceApp.value = await getAppRecord(fork.sourceAppId)
    }
  } catch {
    // silently ignore — badge just won't show
  }
})
</script>
