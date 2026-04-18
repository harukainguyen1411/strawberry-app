<template>
  <div
    class="relative border-2 border-dashed rounded-xl p-8 text-center transition-colors"
    :class="dragOver
      ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
      : 'border-gray-300 dark:border-gray-600 hover:border-amber-400 dark:hover:border-amber-500'"
    @dragover.prevent="dragOver = true"
    @dragleave.prevent="dragOver = false"
    @drop.prevent="onDrop"
  >
    <input
      ref="fileInputRef"
      type="file"
      accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      @change="onFileChange"
    />

    <div v-if="!modelValue" class="pointer-events-none">
      <div class="text-4xl mb-3">&#128196;</div>
      <p class="text-base font-medium text-gray-700 dark:text-gray-300 mb-1">
        Kéo thả file hoặc nhấn để chọn
      </p>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Chỉ chấp nhận file <strong>.docx</strong>, tối đa <strong>10 MB</strong>
      </p>
    </div>

    <div v-else class="pointer-events-none">
      <div class="text-4xl mb-2">&#9989;</div>
      <p class="text-base font-semibold text-gray-800 dark:text-gray-200 truncate max-w-xs mx-auto">
        {{ modelValue.name }}
      </p>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        {{ formatSize(modelValue.size) }}
      </p>
      <button
        class="pointer-events-auto mt-3 text-xs text-red-500 hover:text-red-700 underline"
        type="button"
        @click.stop="clear"
      >
        Xoá file
      </button>
    </div>
  </div>

  <p v-if="errorMessage" class="mt-2 text-sm text-red-600 dark:text-red-400">
    {{ errorMessage }}
  </p>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  modelValue: File | null
}>()

const emit = defineEmits<{
  'update:modelValue': [file: File | null]
}>()

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

const dragOver = ref(false)
const errorMessage = ref<string | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

function validate(file: File): string | null {
  if (file.type !== DOCX_MIME && !file.name.endsWith('.docx')) {
    return 'Chỉ chấp nhận file định dạng .docx'
  }
  if (file.size > MAX_SIZE) {
    return 'File vượt quá giới hạn 10 MB'
  }
  return null
}

function pick(file: File) {
  const err = validate(file)
  if (err) {
    errorMessage.value = err
    emit('update:modelValue', null)
    return
  }
  errorMessage.value = null
  emit('update:modelValue', file)
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) pick(file)
}

function onDrop(event: DragEvent) {
  dragOver.value = false
  const file = event.dataTransfer?.files[0]
  if (file) pick(file)
}

function clear() {
  errorMessage.value = null
  emit('update:modelValue', null)
  if (fileInputRef.value) fileInputRef.value.value = ''
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>
