<template>
  <!-- DropZone stub — V0.11 xfail placeholder -->
  <div>DropZone</div>
</template>
<script setup lang="ts">
defineProps<{ accept?: string; maxSizeMb?: number }>()
defineEmits<{ file: [f: File]; error: [msg: string] }>()
</script>
