<template>
  <div id="app" class="min-h-screen">
    <AppLayout>
      <router-view />
    </AppLayout>
  </div>
</template>

<script setup lang="ts">
import AppLayout from './components/layout/AppLayout.vue'
</script>
