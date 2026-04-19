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
            File tài liệu (.docx) <span class="text-gray-400 font-normal">(tùy chọn)</span>
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
          <span v-if="uploading" class="flex items-center justify-center gap-2">
            <span class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
            Đang tải lên...
          </span>
          <span v-else>Bắt đầu</span>
        </button>

        <p v-if="uploadError" class="text-sm text-red-500 text-center">{{ uploadError }}</p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import DocxUpload from '@/components/bee/DocxUpload.vue'
import { storage } from '@/firebase/config'
import { ref as storageRef, uploadBytes } from 'firebase/storage'

const authStore = useAuthStore()
const router = useRouter()

const signingIn = ref(false)
const signInError = ref<string | null>(null)
const selectedFile = ref<File | null>(null)
const prompt = ref('')
const uploading = ref(false)
const uploadError = ref<string | null>(null)

const canSubmit = computed(
  () => prompt.value.trim().length > 0 && !uploading.value
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

  uploading.value = true
  uploadError.value = null

  let fileRef: string | undefined

  try {
    if (selectedFile.value) {
      const storagePath = `bee-temp/${authStore.user.uid}/${Date.now()}/input.docx`
      const fileStorageRef = storageRef(storage, storagePath)
      await uploadBytes(fileStorageRef, selectedFile.value, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })
      fileRef = storagePath
    }
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : 'Upload thất bại.'
    uploading.value = false
    return
  }

  uploading.value = false

  // Route to intake with text and/or fileRef as query params
  const query: Record<string, string> = {}
  if (prompt.value.trim()) query.textInput = prompt.value.trim()
  if (fileRef) query.fileRef = fileRef

  router.push({ name: 'bee-intake', query })
}
</script>
