<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center py-8 px-4">
    <div class="w-full max-w-2xl flex flex-col" style="height: calc(100vh - 4rem);">
      <!-- Header -->
      <div class="mb-4 text-center">
        <div class="text-4xl mb-1">&#128027;</div>
        <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Bee — Intake</h1>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Trò chuyện với trợ lý để làm rõ yêu cầu trước khi gửi cho Bee
        </p>
      </div>

      <!-- Chat area -->
      <div
        ref="chatContainer"
        class="flex-1 overflow-y-auto bg-white dark:bg-gray-800 rounded-2xl shadow-inner p-4 space-y-4 mb-4"
      >
        <div
          v-for="(msg, idx) in messages"
          :key="idx"
          class="flex"
          :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <!-- Bot message -->
          <div
            v-if="msg.role === 'bot'"
            class="flex items-start gap-2 max-w-[85%]"
          >
            <div class="shrink-0 w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center text-lg">
              &#128027;
            </div>
            <div class="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
              {{ msg.content }}
            </div>
          </div>

          <!-- User message -->
          <div
            v-else
            class="max-w-[85%] bg-gray-100 dark:bg-gray-700 rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap"
          >
            {{ msg.content }}
          </div>
        </div>

        <!-- Typing indicator -->
        <div v-if="thinking" class="flex justify-start">
          <div class="flex items-start gap-2">
            <div class="shrink-0 w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center text-lg">
              &#128027;
            </div>
            <div class="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-2xl rounded-tl-sm px-4 py-3">
              <span class="inline-flex gap-1">
                <span class="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
                <span class="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
                <span class="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
              </span>
            </div>
          </div>
        </div>

        <!-- Final spec ready banner -->
        <div
          v-if="done"
          class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-3 text-sm text-green-700 dark:text-green-300 text-center"
        >
          Yêu cầu đã được làm rõ. Nhấn "Gửi cho Bee" để giao việc.
        </div>

        <!-- Error / fallback -->
        <div
          v-if="intakeError && !done"
          class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-3 text-sm text-red-700 dark:text-red-300 text-center"
        >
          {{ intakeError }}
          <button
            class="ml-2 underline text-red-600 dark:text-red-400"
            @click="skipIntake"
          >
            Bỏ qua và gửi trực tiếp
          </button>
        </div>
      </div>

      <!-- Input area -->
      <div v-if="!done" class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-3">
        <div class="flex gap-2 items-end">
          <textarea
            v-model="userInput"
            rows="2"
            placeholder="Trả lời câu hỏi của trợ lý..."
            class="flex-1 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
            :disabled="thinking || submitting"
            @keydown.enter.prevent="handleEnter"
          ></textarea>
          <button
            class="shrink-0 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-xl py-2 px-4 text-sm transition-colors"
            :disabled="!userInput.trim() || thinking || submitting"
            @click="sendTurn"
          >
            Gửi
          </button>
        </div>
        <div class="mt-2 flex justify-between items-center">
          <button
            class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline transition-colors"
            :disabled="thinking || submitting"
            @click="skipIntake"
          >
            Bỏ qua intake — gửi thẳng
          </button>
        </div>
      </div>

      <!-- Action row when done -->
      <div v-else class="flex gap-3">
        <button
          class="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
          :disabled="submitting"
          @click="submitToGithub"
        >
          <span v-if="submitting" class="flex items-center justify-center gap-2">
            <span class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
            Đang gửi...
          </span>
          <span v-else>Gửi cho Bee &#128027;</span>
        </button>
        <button
          class="px-4 rounded-xl border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          :disabled="submitting"
          @click="$router.push({ name: 'bee-home' })"
        >
          Hủy
        </button>
      </div>

      <p v-if="submitError" class="mt-2 text-sm text-red-500 text-center">{{ submitError }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getFunctions, httpsCallable } from 'firebase/functions'

const router = useRouter()
const route = useRoute()
const functions = getFunctions()

interface ChatMessage {
  role: 'bot' | 'user'
  content: string
}

const messages = ref<ChatMessage[]>([])
const userInput = ref('')
const thinking = ref(false)
const submitting = ref(false)
const done = ref(false)
const intakeError = ref<string | null>(null)
const submitError = ref<string | null>(null)
const sessionId = ref<string | null>(null)
const chatContainer = ref<HTMLElement | null>(null)

// The Vietnamese intro message is hardcoded here so it shows immediately
// before beeIntakeStart returns. Keep in sync with BEE_INTRO_MESSAGE in beeIntake.ts.
const INTRO = 'Chào Haruka! Mình là trợ lý của Bee. Bạn cứ mô tả hoặc tải tài liệu lên — mình sẽ hỏi vài câu để chắc chắn hiểu đúng yêu cầu trước khi giao cho Bee xử lý.'

// Route props passed from BeeHome after upload/text input
const textInput = route.query.textInput as string | undefined

// L4: Validate fileRef from query param on the client side before use.
// The server enforces bee-temp/<uid>/ prefix, but we reject obviously malformed
// values here to avoid sending garbage to the backend at all.
const rawFileRef = route.query.fileRef as string | undefined
const fileRef = rawFileRef && /^bee-temp\/[^/]+\/.+$/.test(rawFileRef) ? rawFileRef : undefined

onMounted(() => {
  messages.value.push({ role: 'bot', content: INTRO })

  if (!fileRef && !textInput) {
    // No input passed — user came here directly, just show intro and wait
    return
  }

  // Auto-kick off the intake session
  startIntake()
})

async function startIntake() {
  thinking.value = true
  intakeError.value = null

  const beeIntakeStart = httpsCallable<
    { textInput?: string; fileRef?: string },
    { sessionId: string; botMessage: string; done: boolean }
  >(functions, 'beeIntakeStart')

  try {
    const result = await beeIntakeStart({ textInput, fileRef })
    sessionId.value = result.data.sessionId
    messages.value.push({ role: 'bot', content: result.data.botMessage })
    done.value = result.data.done
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    intakeError.value = `Không thể khởi động intake (${msg}). Bạn có thể bỏ qua và gửi trực tiếp.`
  } finally {
    thinking.value = false
    scrollToBottom()
  }
}

async function sendTurn() {
  const text = userInput.value.trim()
  if (!text || thinking.value || submitting.value) return

  messages.value.push({ role: 'user', content: text })
  userInput.value = ''
  thinking.value = true
  intakeError.value = null
  await scrollToBottom()

  const beeIntakeTurn = httpsCallable<
    { sessionId: string; userMessage: string },
    { botMessage: string; done: boolean }
  >(functions, 'beeIntakeTurn')

  try {
    const result = await beeIntakeTurn({
      sessionId: sessionId.value!,
      userMessage: text,
    })
    messages.value.push({ role: 'bot', content: result.data.botMessage })
    done.value = result.data.done
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    intakeError.value = `Lỗi: ${msg}`
  } finally {
    thinking.value = false
    scrollToBottom()
  }
}

function handleEnter(e: KeyboardEvent) {
  if (e.shiftKey) return
  sendTurn()
}

async function skipIntake() {
  if (!sessionId.value) {
    // No session yet — can't call skipIntake, go directly to submitting
    // Create a direct issue via old createBeeIssue path
    submitting.value = true
    submitError.value = null
    const createBeeIssue = httpsCallable<
      { question: string; docxStorageUrl?: string },
      { issueNumber: number; issueUrl: string }
    >(functions, 'createBeeIssue')
    try {
      const result = await createBeeIssue({
        question: textInput || '[See attached file]',
        docxStorageUrl: fileRef
          ? `gs://myapps-b31ea.firebasestorage.app/${fileRef}`
          : undefined,
      })
      router.push({ name: 'bee-job', params: { id: String(result.data.issueNumber) } })
    } catch (err) {
      submitError.value = err instanceof Error ? err.message : String(err)
    } finally {
      submitting.value = false
    }
    return
  }

  // Send "just go" to trigger immediate spec
  userInput.value = 'just go'
  await sendTurn()
}

async function submitToGithub() {
  submitting.value = true
  submitError.value = null

  const beeIntakeSubmit = httpsCallable<
    { sessionId: string },
    { issueUrl: string; issueNumber: number }
  >(functions, 'beeIntakeSubmit')

  try {
    const result = await beeIntakeSubmit({ sessionId: sessionId.value! })
    router.push({ name: 'bee-job', params: { id: String(result.data.issueNumber) } })
  } catch (err) {
    submitError.value = err instanceof Error ? err.message : String(err)
  } finally {
    submitting.value = false
  }
}

async function scrollToBottom() {
  await nextTick()
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}
</script>
