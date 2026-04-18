<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="bg-white rounded-lg shadow p-6">
      <h2 class="text-2xl font-semibold text-gray-900">{{ $t('readTracker.settings') }}</h2>
      <p class="text-sm text-gray-600 mt-1">{{ $t('readTrackerSettings.subtitle') }}</p>
    </div>

    <!-- Read Tracker Specific Settings -->
    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">{{ $t('readTrackerSettings.readTrackerSettings') }}</h3>
      <p class="text-sm text-gray-600">{{ $t('readTrackerSettings.comingSoon') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

useI18n() // Required for $t() in template
</script>

<style scoped>
.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4) {
  font-weight: 600;
  margin-top: 0.75em;
  margin-bottom: 0.5em;
  color: #111827;
}

.markdown-content :deep(h1) { font-size: 1.25em; }
.markdown-content :deep(h2) { font-size: 1.125em; }
.markdown-content :deep(h3) { font-size: 1em; }
.markdown-content :deep(h4) { font-size: 0.875em; }

.markdown-content :deep(p) {
  margin-bottom: 0.5em;
  line-height: 1.5;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin-left: 1.25em;
  margin-bottom: 0.5em;
  padding-left: 0.5em;
}

.markdown-content :deep(li) {
  margin-bottom: 0.25em;
}

.markdown-content :deep(strong) {
  font-weight: 600;
  color: #111827;
}

.markdown-content :deep(em) {
  font-style: italic;
}

.markdown-content :deep(code) {
  background-color: #f3f4f6;
  padding: 0.125em 0.25em;
  border-radius: 0.25rem;
  font-family: ui-monospace, monospace;
  font-size: 0.875em;
}

.markdown-content :deep(pre) {
  background-color: #f3f4f6;
  padding: 0.75em;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin-bottom: 0.5em;
}

.markdown-content :deep(pre code) {
  background-color: transparent;
  padding: 0;
}

.markdown-content :deep(a) {
  color: #4f46e5;
  text-decoration: underline;
}

.markdown-content :deep(a:hover) {
  color: #4338ca;
}

.markdown-content :deep(blockquote) {
  border-left: 3px solid #d1d5db;
  padding-left: 0.75em;
  margin-left: 0;
  color: #6b7280;
  font-style: italic;
}
</style>
