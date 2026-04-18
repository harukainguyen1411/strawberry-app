<template>
  <div class="min-h-screen flex flex-col bg-ds-bg">
    <PlatformHeader />
    <main class="flex-1 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6 max-w-7xl mx-auto w-full">
      <slot />
    </main>
    <footer class="border-t border-ds-border/30 py-4 px-4 flex items-center justify-center gap-2 text-xs text-ds-muted/50">
      <DsIcon name="neeko" :size="14" class="opacity-60" />
      <span>Icons by <span class="text-ds-muted/70">Neeko</span></span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import PlatformHeader from './PlatformHeader.vue'
import { DsIcon } from '@shared/ui/icons'
</script>
