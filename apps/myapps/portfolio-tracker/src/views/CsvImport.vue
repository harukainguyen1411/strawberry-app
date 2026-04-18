<template>
  <!--
    CsvImport — two-step CSV import flow.
    Step 1: Source select + DropZone + CsvPasteArea + "Parse →" CTA
    Step 2: Preview + commit (V0.12)
    Refs V0.11
  -->
  <div class="px-4 py-6 max-w-2xl mx-auto">
    <!-- Step 1 -->
    <template v-if="step === 'step1'">
      <h1 class="text-2xl font-medium mb-1" style="color: var(--text);">Import trades</h1>
      <p class="text-sm mb-6" style="color: var(--muted);">
        Paste a CSV from Trading 212 or Interactive Brokers, or drop a file below.
      </p>

      <!-- Source select -->
      <div class="mb-4">
        <label class="block text-xs font-medium mb-1.5 uppercase tracking-wide" style="color: var(--muted);">
          Source
        </label>
        <SourceSelect v-model="source" @update:modelValue="onSourceChange" />
      </div>

      <!-- Drop zone -->
      <div class="mb-4">
        <DropZone
          accept=".csv"
          :maxSizeMb="10"
          @file="onFileDropped"
          @error="onDropError"
        />
      </div>

      <!-- Divider -->
      <div class="flex items-center gap-3 my-4">
        <div class="flex-1 h-px" style="background: var(--border);"></div>
        <span class="text-xs" style="color: var(--muted);">or paste</span>
        <div class="flex-1 h-px" style="background: var(--border);"></div>
      </div>

      <!-- Paste area -->
      <div class="mb-6">
        <CsvPasteArea v-model="pasteText" />
      </div>

      <!-- Error banner (parse failure) -->
      <div
        v-if="parseError"
        role="alert"
        class="mb-4 rounded-lg px-4 py-3 text-sm"
        style="
          border: 1px solid var(--accent);
          background: color-mix(in srgb, var(--accent) 10%, transparent);
          color: var(--text);
        "
      >
        <p class="font-medium mb-1" style="color: var(--accent);">
          Could not parse CSV
        </p>
        <p>{{ parseError }}</p>
      </div>

      <!-- CTAs -->
      <div class="flex items-center gap-3">
        <router-link
          to="/"
          class="ds-btn-ghost"
          aria-label="Cancel import and return to dashboard"
        >
          Cancel
        </router-link>
        <button
          data-testid="parse-btn"
          class="ds-btn-primary"
          :disabled="!canParse || parsing"
          :aria-disabled="!canParse || parsing"
          @click="onParse"
        >
          <span v-if="parsing">Parsing…</span>
          <span v-else>Parse →</span>
        </button>
      </div>

      <!-- Helper when empty -->
      <p
        v-if="!canParse && !parseError"
        class="mt-2 text-xs"
        style="color: var(--muted);"
        aria-live="polite"
      >
        Add a CSV to continue
      </p>
    </template>

    <!-- Step 2 placeholder (V0.12) -->
    <template v-else-if="step === 'step2'">
      <!-- V0.12 implements this step -->
      <slot name="step2" :parseResult="parseResult" :source="source" :onBack="goBack" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import DropZone from '@/components/DropZone.vue'
import CsvPasteArea from '@/components/CsvPasteArea.vue'
import SourceSelect from '@/components/SourceSelect.vue'
import { useCsvParser, type CsvSource, type ParseResult } from '@/composables/useCsvParser'

type Step = 'step1' | 'step2'

const step = ref<Step>('step1')
const source = ref<CsvSource | ''>('')
const pasteText = ref('')
const fileText = ref<string | null>(null)
const dropError = ref<string | null>(null)
const parseResult = ref<ParseResult | null>(null)

const { parse, parseError, loading: parsing, reset: resetParser } = useCsvParser()

/** True when there's something to parse (file dropped or text pasted) */
const canParse = computed(() => {
  return !!(fileText.value || pasteText.value.trim()) && !!source.value
})

function onSourceChange() {
  // Clear prior parse state when source changes
  parseResult.value = null
  parseError.value = null
  fileText.value = null
  pasteText.value = ''
  dropError.value = null
  resetParser()
}

function onDropError(msg: string) {
  dropError.value = msg
}

function onFileDropped(file: File) {
  dropError.value = null
  const reader = new FileReader()
  reader.onload = (e) => {
    fileText.value = e.target?.result as string ?? null
  }
  reader.readAsText(file)
}

async function onParse() {
  if (!canParse.value || parsing.value) return

  const text = fileText.value ?? pasteText.value
  if (!text || !source.value) return

  await parse(source.value, text)

  if (!parseError.value) {
    parseResult.value = useCsvParser().result.value
    step.value = 'step2'
  }
}

function goBack() {
  step.value = 'step1'
  parseResult.value = null
  resetParser()
}

// Expose for parent / V0.12 slot
defineExpose({ step, source, parseResult, goBack })
</script>
