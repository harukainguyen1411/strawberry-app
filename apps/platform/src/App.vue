<template>
  <div id="app" class="min-h-screen">
    <PlatformLayout>
      <router-view />
    </PlatformLayout>
  </div>
</template>

<script setup lang="ts">
import PlatformLayout from './components/layout/PlatformLayout.vue'
</script>
