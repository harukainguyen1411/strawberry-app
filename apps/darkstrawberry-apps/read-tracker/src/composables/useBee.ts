import { ref, type Ref } from 'vue'
import { storage } from '@/firebase/config'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { ref as storageRef, uploadBytes } from 'firebase/storage'

export interface BeeJobStatus {
  issueNumber: number
  state: string
  labels: string[]
  answer: string | null
  resultDocxUrl: string | null
}

export interface BeeHistoryItem {
  number: number
  title: string
  createdAt: string
  closedAt: string | null
}

const functions = getFunctions()

export function useBee() {
  const submitting: Ref<boolean> = ref(false)
  const submitError: Ref<string | null> = ref(null)
  const currentJob: Ref<BeeJobStatus | null> = ref(null)
  const jobHistory: Ref<BeeHistoryItem[]> = ref([])
  const polling: Ref<boolean> = ref(false)

  let pollTimer: ReturnType<typeof setInterval> | null = null

  async function submitJob(
    uid: string,
    file: File | null,
    prompt: string
  ): Promise<number> {
    submitting.value = true
    submitError.value = null

    try {
      let docxStorageUrl: string | undefined

      // Upload docx to Storage if provided
      if (file) {
        const storagePath = `bee-temp/${uid}/${Date.now()}/input.docx`
        const fileRef = storageRef(storage, storagePath)
        await uploadBytes(fileRef, file, {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        })
        docxStorageUrl = `gs://myapps-b31ea.firebasestorage.app/${storagePath}`
      }

      // Call Cloud Function to create GitHub issue
      const createBeeIssue = httpsCallable<
        { question: string; docxStorageUrl?: string },
        { issueNumber: number; issueUrl: string }
      >(functions, 'createBeeIssue')

      const result = await createBeeIssue({
        question: prompt,
        docxStorageUrl
      })

      return result.data.issueNumber
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      submitError.value = message
      throw err
    } finally {
      submitting.value = false
    }
  }

  function startPolling(issueNumber: number): void {
    polling.value = true
    currentJob.value = {
      issueNumber,
      state: 'open',
      labels: ['bee', 'ready'],
      answer: null,
      resultDocxUrl: null
    }

    const getBeeStatus = httpsCallable<
      { issueNumber: number },
      BeeJobStatus
    >(functions, 'getBeeStatus')

    const poll = async () => {
      try {
        const result = await getBeeStatus({ issueNumber })
        currentJob.value = { ...result.data, issueNumber }

        // Stop polling when done
        if (result.data.labels.includes('done') || result.data.state === 'closed') {
          stopPolling()
        }
      } catch {
        // Transient error — keep polling
      }
    }

    poll()
    pollTimer = setInterval(poll, 10000)
  }

  function stopPolling(): void {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    polling.value = false
  }

  async function loadHistory(): Promise<void> {
    const listBeeIssues = httpsCallable<
      Record<string, never>,
      BeeHistoryItem[]
    >(functions, 'listBeeIssues')

    const result = await listBeeIssues({})
    jobHistory.value = result.data
  }

  return {
    submitting,
    submitError,
    currentJob,
    jobHistory,
    polling,
    submitJob,
    startPolling,
    stopPolling,
    loadHistory
  }
}
