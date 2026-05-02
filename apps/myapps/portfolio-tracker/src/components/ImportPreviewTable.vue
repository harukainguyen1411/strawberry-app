<template>
  <div class="ds-glass rounded-xl overflow-hidden">
    <div v-if="title" class="px-4 py-2 text-xs font-medium uppercase tracking-wide" style="color: var(--muted); border-bottom: 1px solid var(--border);">
      {{ title }}
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr style="border-bottom: 1px solid var(--border);">
            <th
              v-for="col in columns"
              :key="col.key"
              scope="col"
              class="px-4 py-2 text-left font-medium text-xs uppercase tracking-wide"
              style="color: var(--muted);"
            >
              {{ col.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, i) in visibleRows"
            :key="i"
            data-testid="preview-row"
            style="border-bottom: 1px solid var(--border);"
          >
            <td
              v-for="col in columns"
              :key="col.key"
              class="px-4 py-2"
              :class="col.align === 'right' ? 'text-right tabular-nums' : ''"
              style="color: var(--text);"
            >
              {{ formatCell(row, col) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <button
      v-if="canExpand"
      data-testid="show-all-btn"
      type="button"
      class="w-full px-4 py-2 text-xs"
      style="color: var(--accent); border-top: 1px solid var(--border);"
      @click="expanded = true"
    >
      Show all {{ rows.length }} rows →
    </button>
    <button
      v-else-if="expanded && rows.length > maxVisible"
      data-testid="show-less-btn"
      type="button"
      class="w-full px-4 py-2 text-xs"
      style="color: var(--muted); border-top: 1px solid var(--border);"
      @click="expanded = false"
    >
      Show less
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface ColumnDef {
  key: string
  label: string
  align?: 'left' | 'right'
  format?: (value: unknown, row: Record<string, unknown>) => string
}

const props = withDefaults(
  defineProps<{
    rows: Record<string, unknown>[]
    columns: ColumnDef[]
    maxVisible?: number
    title?: string
  }>(),
  {
    maxVisible: 5,
    title: '',
  },
)

const expanded = ref(false)

const canExpand = computed(() => !expanded.value && props.rows.length > props.maxVisible)

const visibleRows = computed(() => {
  if (expanded.value) return props.rows
  return props.rows.slice(0, props.maxVisible)
})

function formatCell(row: Record<string, unknown>, col: ColumnDef): string {
  const value = row[col.key]
  if (col.format) return col.format(value, row)
  if (value == null) return ''
  return String(value)
}
</script>
