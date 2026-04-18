<template>
  <div class="min-h-screen flex flex-col bg-ds-bg">
    <AppHeader />
    <main class="flex-1 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6 max-w-7xl mx-auto w-full">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import AppHeader from './AppHeader.vue'
</script>
