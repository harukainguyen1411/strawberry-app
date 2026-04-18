<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-start py-12 px-4">
    <!-- Sign-in gate -->
    <div v-if="!authStore.user" class="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
      <div class="text-5xl mb-4">&#128027;</div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Bee — Trợ lý soạn thảo</h1>
      <p class="text-gray-500 dark:text-gray-400 mb-6 text-sm">
        Đăng nhập bằng tài khoản Google để bắt đầu
      </p>
      <button
        class="w-full flex items-center justify-center gap-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shadow-sm"
        :disabled="signingIn"
        @click="handleSignIn"
      >
        <span v-if="signingIn" class="animate-spin h-4 w-4 border-2 border-amber-500 border-t-transparent rounded-full"></span>
        <span v-else>&#128100;</span>
        {{ signingIn ? 'Đang đăng nhập...' : 'Đăng nhập với Google' }}
      </button>
      <p v-if="signInError" class="mt-3 text-sm text-red-500">{{ signInError }}</p>
    </div>

    <!-- Upload form -->
    <div v-else class="w-full max-w-xl">
      <div class="mb-8 text-center">
        <div class="text-5xl mb-2">&#128027;</div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Bee — Trợ lý soạn thảo</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Tải lên tài liệu và nhập yêu cầu để nhận bình luận
        </p>
      </div>

      <form
        class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 space-y-6"
        @submit.prevent="handleSubmit"
      >
        <!-- DocxUpload -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            File tài liệu (.docx)
          </label>
          <DocxUpload v-model="selectedFile" />
        </div>

        <!-- Prompt textarea -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Yêu cầu của bạn
          </label>
          <textarea
            v-model="prompt"
            rows="5"
            placeholder="Nhập yêu cầu bằng tiếng Việt, ví dụ: Hãy bình luận về cách hành văn và chính tả trong tài liệu này..."
            class="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
          ></textarea>
        </div>

        <!-- Submit -->
        <button
          type="submit"
          class="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 px-6 text-sm transition-colors"
          :disabled="!canSubmit"
        >
          <span v-if="submitting" class="flex items-center justify-center gap-2">
            <span class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
            Đang tải lên...
          </span>
          <span v-else>Gửi yêu cầu</span>
        </button>

        <p v-if="submitError" class="text-sm text-red-500 text-center">{{ submitError }}</p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import DocxUpload from '@/components/bee/DocxUpload.vue'
import { useBee } from '@/composables/useBee'

const authStore = useAuthStore()
const router = useRouter()

const signingIn = ref(false)
const signInError = ref<string | null>(null)
const selectedFile = ref<File | null>(null)
const prompt = ref('')

const { submitting, submitError, submitJob } = useBee()

const canSubmit = computed(
  () => !!selectedFile.value && prompt.value.trim().length > 0 && !submitting.value
)

async function handleSignIn() {
  signingIn.value = true
  signInError.value = null
  try {
    await authStore.login()
  } catch {
    signInError.value = 'Đăng nhập thất bại. Vui lòng thử lại.'
  } finally {
    signingIn.value = false
  }
}

async function handleSubmit() {
  if (!canSubmit.value || !authStore.user) return
  try {
    const jobId = await submitJob(
      authStore.user.uid,
      selectedFile.value!,
      prompt.value.trim()
    )
    router.push({ name: 'bee-job', params: { id: jobId } })
  } catch {
    // submitError is set by useBee
  }
}
</script>
