<template>
  <!--
    DropZone — drag-and-drop or browse-file CSV input.
    Props:
      accept   - accepted MIME/extension string (default ".csv")
      maxSizeMb - max file size in MB (default 10)
    Emits:
      file(f: File)       — valid CSV dropped/selected
      error(msg: string)  — validation failure
    States: idle | dragover | error
    Refs V0.11
  -->
  <div
    role="region"
    :aria-label="`Drop zone — ${accept} files accepted`"
    class="relative flex flex-col items-center justify-center rounded-xl cursor-pointer transition-colors select-none"
    :class="[
      state === 'dragover' ? 'dropzone--dragover' : '',
      state === 'error' ? 'dropzone--error' : '',
    ]"
    style="
      min-height: 200px;
      border: 2px dashed var(--border-hi);
      background: var(--surface);
    "
    :style="state === 'dragover' ? 'background: var(--surface-hi); border-color: var(--accent-soft);' : ''"
    aria-live="polite"
    :aria-describedby="errorId"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
    @click="openFilePicker"
    @keydown.enter.prevent="openFilePicker"
    @keydown.space.prevent="openFilePicker"
    tabindex="0"
  >
    <!-- Hidden file input -->
    <input
      ref="inputRef"
      type="file"
      :accept="accept"
      class="sr-only"
      aria-hidden="true"
      tabindex="-1"
      @change="onFileInputChange"
    />

    <!-- Idle / dragover content -->
    <template v-if="state !== 'error'">
      <svg
        class="mb-3 opacity-40"
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        style="color: var(--muted);"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <p class="text-sm font-medium" style="color: var(--text);">
        <span v-if="state === 'dragover'">Release to upload</span>
        <span v-else>Drop CSV here &nbsp;<span style="color: var(--muted);">or</span>&nbsp;
          <button
            type="button"
            class="underline font-medium"
            style="color: var(--accent-soft);"
            aria-label="Browse for a CSV file"
            @click.stop="openFilePicker"
            @keydown.enter.stop.prevent="openFilePicker"
          >browse</button>
        </span>
      </p>
      <p class="text-xs mt-1" style="color: var(--muted);">
        Max {{ maxSizeMb }} MB · {{ accept }} only
      </p>
    </template>

    <!-- Error state -->
    <template v-else>
      <svg
        class="mb-3"
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        style="color: var(--accent);"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p :id="errorId" class="text-sm" style="color: var(--accent);">{{ errorMessage }}</p>
      <button
        type="button"
        class="mt-2 text-xs underline"
        style="color: var(--muted);"
        @click.stop="reset"
      >Clear</button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = withDefaults(defineProps<{
  accept?: string
  maxSizeMb?: number
}>(), {
  accept: '.csv',
  maxSizeMb: 10,
})

const emit = defineEmits<{
  file: [f: File]
  error: [msg: string]
}>()

type State = 'idle' | 'dragover' | 'error'

const state = ref<State>('idle')
const errorMessage = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const errorId = computed(() => 'dropzone-error-' + Math.random().toString(36).slice(2, 8))

function openFilePicker() {
  inputRef.value?.click()
}

function reset() {
  state.value = 'idle'
  errorMessage.value = ''
  if (inputRef.value) inputRef.value.value = ''
}

function validateFile(file: File): string | null {
  // Check extension or MIME
  const name = file.name.toLowerCase()
  const isCsvMime = file.type === 'text/csv' || file.type === 'application/csv' || file.type === 'text/plain'
  const isCsvExt = name.endsWith('.csv')

  if (!isCsvExt && !isCsvMime) {
    return `Invalid file type: "${file.name}". Please upload a .csv file.`
  }

  const maxBytes = props.maxSizeMb * 1024 * 1024
  if (file.size > maxBytes) {
    return `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum is ${props.maxSizeMb} MB.`
  }

  return null
}

function handleFile(file: File) {
  const err = validateFile(file)
  if (err) {
    state.value = 'error'
    errorMessage.value = err
    emit('error', err)
  } else {
    state.value = 'idle'
    emit('file', file)
  }
}

function onDragOver() {
  state.value = 'dragover'
}

function onDragLeave() {
  if (state.value === 'dragover') {
    state.value = 'idle'
  }
}

function onDrop(e: DragEvent) {
  state.value = 'idle'
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return
  handleFile(files[0])
}

function onFileInputChange(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files || files.length === 0) return
  handleFile(files[0])
}

// Expose handleFile for testing (DragEvent.dataTransfer is read-only in jsdom)
defineExpose({ handleFile, reset })
</script>
