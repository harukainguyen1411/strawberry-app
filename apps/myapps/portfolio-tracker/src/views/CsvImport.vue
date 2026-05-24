<template>
  <!--
    CsvImport — two-step CSV import flow.
    Step 1: Source select + DropZone + CsvPasteArea + "Parse →" CTA (V0.11)
    Step 2: Preview + commit (V0.12)
  -->
  <div class="px-4 py-6 max-w-2xl mx-auto">
    <!-- Step 1 -->
    <template v-if="step === 'step1'">
      <h1 class="text-2xl font-medium mb-1" style="color: var(--text);">Import portfolio</h1>
      <p class="text-sm mb-6" style="color: var(--muted);">
        Drop your T212 Activity Statement (PDF) for the live snapshot, or paste an IB CSV / T212 trading-history CSV for trade-by-trade data.
      </p>

      <!-- Source select -->
      <div class="mb-4">
        <label class="block text-xs font-medium mb-1.5 uppercase tracking-wide" style="color: var(--muted);">
          Source
        </label>
        <SourceSelect v-model="source" @update:modelValue="onSourceChange" />
      </div>

      <!-- Drop zone -->
      <div class="mb-4">
        <DropZone
          accept=".csv,.pdf"
          :maxSizeMb="10"
          @file="onFileDropped"
          @error="onDropError"
        />
      </div>

      <!-- Divider -->
      <div class="flex items-center gap-3 my-4">
        <div class="flex-1 h-px" style="background: var(--border);"></div>
        <span class="text-xs" style="color: var(--muted);">or paste</span>
        <div class="flex-1 h-px" style="background: var(--border);"></div>
      </div>

      <!-- Paste area -->
      <div class="mb-6">
        <CsvPasteArea v-model="pasteText" @too-large="onPasteTooLarge" />
      </div>

      <!-- Drop / paste rejection banner (file too large, bad MIME, paste too large) -->
      <div
        v-if="dropError"
        role="alert"
        aria-live="polite"
        class="mb-4 rounded-lg px-4 py-3 text-sm"
        style="
          border: 1px solid var(--accent);
          background: color-mix(in srgb, var(--accent) 10%, transparent);
          color: var(--text);
        "
      >
        <p class="font-medium mb-1" style="color: var(--accent);">
          File / paste rejected
        </p>
        <p>{{ dropError }}</p>
      </div>

      <!--
        Parse-error surface: toast (see onParse → showToast). The previous
        inline banner here was redundant with the toast and was removed in
        V0.1.2 to keep parse-error UX consistent with commit-error UX.
      -->

      <!-- CTAs -->
      <div class="flex items-center gap-3">
        <router-link
          to="/"
          class="ds-btn-ghost"
          aria-label="Cancel import and return to dashboard"
        >
          Cancel
        </router-link>
        <button
          data-testid="parse-btn"
          class="ds-btn-primary"
          :disabled="!canParse || parsing"
          :aria-disabled="!canParse || parsing"
          @click="onParse"
        >
          <span v-if="parsing">Parsing…</span>
          <span v-else>Parse →</span>
        </button>
      </div>

      <!-- Helper when empty -->
      <p
        v-if="!canParse && !parseError"
        class="mt-2 text-xs"
        style="color: var(--muted);"
        aria-live="polite"
      >
        Add a CSV to continue
      </p>
    </template>

    <!-- PDF importing: full-page loader while PDF callable runs -->
    <template v-else-if="step === 'pdf-importing'">
      <div class="flex flex-col items-center justify-center py-16 gap-4">
        <p class="text-base" style="color: var(--text);">Importing T212 Activity Statement…</p>
        <p class="text-sm" style="color: var(--muted);">Parsing positions, cash, and FX rates.</p>
      </div>
    </template>

    <!-- Step 2: preview + commit -->
    <template v-else-if="step === 'step2' && parseResult">
      <button
        type="button"
        class="text-sm mb-3 inline-flex items-center gap-1"
        style="color: var(--muted);"
        data-testid="back-btn"
        @click="goBack"
      >
        ← Back
      </button>
      <h1 class="text-2xl font-medium mb-1" style="color: var(--text);">
        Preview · {{ parseResult.trades.length }} trades, {{ parseResult.positions.length }} positions
      </h1>
      <p class="text-sm mb-4" style="color: var(--muted);">
        Source: {{ sourceLabel }}
      </p>

      <!-- Bad-headers parse → ErrorBanner instead of preview -->
      <ErrorBanner
        v-if="hasBadHeaders"
        title="Could not parse CSV"
        message="Required columns are missing. Re-export from your broker and try again."
        :receivedHeaders="receivedHeaders"
        class="mb-4"
      />

      <!-- Partial parse → warn banner -->
      <WarnBanner
        v-else-if="parseResult.errors.length > 0"
        :count="parseResult.errors.length"
        :message="`${parseResult.errors.length} rows skipped`"
        :details="errorLines"
        class="mb-4"
      />

      <template v-if="!hasBadHeaders">
        <!-- Holdings preview -->
        <div class="mb-4">
          <ImportPreviewTable
            title="Holdings"
            :rows="positionRows"
            :columns="positionColumns"
            :maxVisible="5"
          />
        </div>

        <!-- Trades preview -->
        <div class="mb-6">
          <ImportPreviewTable
            title="Trades"
            :rows="tradeRows"
            :columns="tradeColumns"
            :maxVisible="5"
          />
        </div>

        <!-- CTAs -->
        <div class="flex items-center gap-3">
          <button type="button" class="ds-btn-ghost" @click="goBack">Cancel</button>
          <button
            data-testid="commit-btn"
            type="button"
            class="ds-btn-primary"
            :disabled="committing"
            :aria-disabled="committing"
            @click="onCommit"
          >
            <span v-if="committing">Committing…</span>
            <span v-else>Commit import →</span>
          </button>
        </div>
      </template>
    </template>

    <Toast
      :show="toastVisible"
      :message="toastMessage"
      :onRetry="toastRetry ? onRetry : undefined"
      @dismiss="toastVisible = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import DropZone from '@/components/DropZone.vue'
import CsvPasteArea from '@/components/CsvPasteArea.vue'
import SourceSelect from '@/components/SourceSelect.vue'
import ImportPreviewTable from '@/components/ImportPreviewTable.vue'
import WarnBanner from '@/components/WarnBanner.vue'
import ErrorBanner from '@/components/ErrorBanner.vue'
import Toast from '@/components/Toast.vue'
import { useCsvParser, type CsvSource, type ParseResult } from '../../../src/composables/portfolio-tracker/useCsvParser'
import { useImportCsv } from '../../../src/composables/portfolio-tracker/useImportCsv'
import { useImportT212Pdf, detectFileFormat } from '../../../src/composables/portfolio-tracker/useImportT212Pdf'

type Step = 'step1' | 'step2' | 'pdf-importing'

const router = useRouter()
const step = ref<Step>('step1')
const source = ref<CsvSource | ''>('')
const pasteText = ref('')
const fileText = ref<string | null>(null)
/** Raw bytes of the dropped file (used for format detection + PDF import) */
const fileBytes = ref<Uint8Array | null>(null)
const dropError = ref<string | null>(null)
const parseResult = ref<ParseResult | null>(null)

const { parse, parseError, loading: parsing, reset: resetParser, result: parserResult } = useCsvParser()
const { importCsv, loading: committing } = useImportCsv()
const { importT212Pdf, loading: pdfImporting } = useImportT212Pdf()

const toastVisible = ref(false)
const toastMessage = ref('')
const toastRetry = ref(false)

const canParse = computed(() => {
  // PDF files auto-submit directly (no parse step needed)
  if (fileBytes.value && detectFileFormat(fileBytes.value) === 'pdf') return false
  return !!(fileText.value || pasteText.value.trim()) && !!source.value
})

const sourceLabel = computed(() => (source.value === 'T212' ? 'Trading 212' : 'Interactive Brokers'))

const hasBadHeaders = computed(() => {
  if (!parseResult.value) return false
  return parseResult.value.errors.some((e) => e.kind === 'bad_headers')
})

const receivedHeaders = computed<string[]>(() => {
  if (!parseResult.value) return []
  const bad = parseResult.value.errors.find((e) => e.kind === 'bad_headers') as
    | { kind: string; received?: string[] }
    | undefined
  return bad?.received ?? []
})

const errorLines = computed<string[]>(() => {
  if (!parseResult.value) return []
  return parseResult.value.errors.map((e) => {
    const row = (e as { row?: number }).row
    const reason = (e as { reason?: string; kind: string }).reason ?? e.kind
    return row != null ? `Row ${row}: ${reason}` : reason
  })
})

const positionColumns = [
  { key: 'ticker', label: 'Ticker' },
  { key: 'broker', label: 'Broker' },
  { key: 'quantity', label: 'Qty', align: 'right' as const },
  { key: 'avgCost', label: 'Avg cost', align: 'right' as const },
]

const positionRows = computed(() => {
  if (!parseResult.value) return []
  return parseResult.value.positions.map((p) => ({
    ticker: p.ticker,
    broker: p.broker,
    quantity: p.quantity,
    avgCost: formatMoney(p.avgCost),
  }))
})

const tradeColumns = [
  { key: 'executedAt', label: 'Date' },
  { key: 'ticker', label: 'Ticker' },
  { key: 'side', label: 'Side' },
  { key: 'quantity', label: 'Qty', align: 'right' as const },
  { key: 'price', label: 'Price', align: 'right' as const },
]

const tradeRows = computed(() => {
  if (!parseResult.value) return []
  return parseResult.value.trades.map((t) => ({
    executedAt: formatDate(t.executedAt),
    ticker: t.ticker,
    side: t.side,
    quantity: t.quantity,
    price: formatMoney(t.price),
  }))
})

function formatMoney(m: { amount: number; currency: string } | null | undefined): string {
  if (!m) return ''
  return `${m.currency} ${m.amount.toFixed(2)}`
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return ''
  const date = d instanceof Date ? d : new Date(d)
  if (isNaN(date.getTime())) return String(d)
  return date.toISOString().slice(0, 10)
}

function onSourceChange() {
  parseResult.value = null
  parseError.value = null
  fileText.value = null
  fileBytes.value = null
  pasteText.value = ''
  dropError.value = null
  resetParser()
}

function onDropError(msg: string) {
  dropError.value = msg
}

function onPasteTooLarge(sizeBytes: number) {
  const mb = (sizeBytes / 1024 / 1024).toFixed(0)
  dropError.value = `Pasted content is too large (${mb} MB). Maximum is 10 MB.`
}

function onFileDropped(file: File) {
  dropError.value = null
  fileText.value = null
  fileBytes.value = null

  // Read as ArrayBuffer first to detect format from magic bytes.
  // After detection: PDF → importT212Pdf; CSV → fileText for parse step.
  const arrayReader = new FileReader()
  arrayReader.onload = async (e) => {
    const buf = e.target?.result as ArrayBuffer | null
    if (!buf) {
      dropError.value = 'Could not read the file. Please try again.'
      return
    }
    const bytes = new Uint8Array(buf)
    fileBytes.value = bytes
    const fmt = detectFileFormat(bytes)

    if (fmt === 'unsupported') {
      dropError.value = 'Unsupported format. Please upload a PDF (T212 Activity Statement) or CSV.'
      fileBytes.value = null
      return
    }

    if (fmt === 'pdf') {
      // PDF path: auto-import without requiring Source select or Parse step
      try {
        step.value = 'pdf-importing'
        const result = await importT212Pdf(bytes)
        if (result.errors && result.errors.length > 0 && result.positionsWritten === 0) {
          step.value = 'step1'
          dropError.value = `Could not parse PDF: ${result.errors[0].message ?? result.errors[0].kind}`
          return
        }
        showToast(`Imported ${result.positionsWritten} positions from T212 statement`, false)
        router.push('/')
      } catch {
        step.value = 'step1'
        showToast("PDF import failed. Retry?", true)
      }
      return
    }

    // CSV path: read as text for the existing parse step
    const textReader = new FileReader()
    textReader.onload = (te) => {
      fileText.value = (te.target?.result as string) ?? null
    }
    textReader.onerror = () => {
      fileText.value = null
      dropError.value = 'Could not read the file. Please try again.'
    }
    textReader.readAsText(file)
  }
  arrayReader.onerror = () => {
    dropError.value = 'Could not read the file. Please try again.'
  }
  arrayReader.readAsArrayBuffer(file)
}

async function onParse() {
  if (!canParse.value || parsing.value) return
  const text = fileText.value ?? pasteText.value
  if (!text || !source.value) return
  await parse(source.value, text)
  if (!parseError.value) {
    parseResult.value = parserResult.value
    if (parseResult.value) step.value = 'step2'
  } else {
    showToast(parseError.value, false)
  }
}

async function onCommit() {
  if (!parseResult.value || committing.value || hasBadHeaders.value || !source.value) return
  const csv = fileText.value ?? pasteText.value
  if (!csv || !csv.trim()) {
    showToast('No CSV content to import.', false)
    return
  }
  try {
    const result = await importCsv(source.value, csv)
    if (result.errors && result.errors.length > 0 && result.tradesAdded === 0) {
      // Server rejected everything (e.g. bad headers detected on the
      // server side). Stay on Step 2 so the user can fix and retry.
      showToast(`Import rejected: ${result.errors.length} errors. See preview.`, true)
      return
    }
    const positionsPart = `${result.positionsWritten} position${result.positionsWritten === 1 ? '' : 's'}`
    if (result.errors && result.errors.length > 0) {
      showToast(`Imported ${result.tradesAdded} trades · ${positionsPart}, ${result.errors.length} skipped`, false)
    } else {
      showToast(`Imported ${result.tradesAdded} trades · ${positionsPart}`, false)
    }
    router.push('/')
  } catch {
    showToast("Couldn't save import. Retry?", true)
  }
}

function onRetry() {
  toastVisible.value = false
  void onCommit()
}

function showToast(message: string, retry: boolean) {
  toastMessage.value = message
  toastRetry.value = retry
  toastVisible.value = true
}

function goBack() {
  step.value = 'step1'
  parseResult.value = null
  fileBytes.value = null
  resetParser()
}

defineExpose({ step, source, parseResult, goBack, pdfImporting })
</script>
