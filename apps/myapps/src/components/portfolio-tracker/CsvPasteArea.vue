<template>
  <!--
    CsvPasteArea — textarea for pasting CSV text.
    v-model: string (raw CSV text)
    Max ~1 MB enforced via char count warning.
    Refs V0.11
  -->
  <div class="relative">
    <textarea
      ref="textareaRef"
      :value="modelValue"
      rows="8"
      class="w-full rounded-lg px-3 py-2.5 text-sm font-mono resize-y focus:outline-none"
      style="
        background: var(--surface-hi);
        border: 1px solid var(--border-hi);
        color: var(--text);
        min-height: 120px;
        caret-color: var(--accent-soft);
      "
      :style="isTooLarge ? 'border-color: var(--accent);' : ''"
      placeholder="Paste CSV content here…"
      aria-label="Paste CSV content"
      :aria-describedby="isTooLarge ? 'paste-size-warn' : undefined"
      spellcheck="false"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      @input="onInput"
    />
    <!-- Size warning -->
    <p
      v-if="isTooLarge"
      id="paste-size-warn"
      class="mt-1 text-xs"
      style="color: var(--accent);"
      role="alert"
    >
      Content is very large ({{ sizeMb }} MB). Performance may degrade above 1 MB.
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  /** Emitted when pasted content exceeds the hard size limit (10 MB). */
  'too-large': [sizeBytes: number]
}>()

const HARD_MAX_BYTES = 10 * 1024 * 1024  // 10 MB hard reject — mirrors DropZone maxSizeMb default
const MAX_BYTES = 1 * 1024 * 1024        // 1 MB soft warning (warn only)

const textareaRef = ref<HTMLTextAreaElement | null>(null)

const byteLength = computed(() => new Blob([props.modelValue]).size)
const isTooLarge = computed(() => byteLength.value > MAX_BYTES)
const sizeMb = computed(() => (byteLength.value / 1024 / 1024).toFixed(1))

function onInput(e: Event) {
  const value = (e.target as HTMLTextAreaElement).value
  const bytes = new Blob([value]).size
  if (bytes > HARD_MAX_BYTES) {
    // Hard reject: do not propagate the oversized value to the parent.
    // Restore the previous (valid) value in the textarea and emit 'too-large'
    // so the parent can surface a user-facing error.
    ;(e.target as HTMLTextAreaElement).value = props.modelValue
    emit('too-large', bytes)
    return
  }
  emit('update:modelValue', value)
}
</script>
