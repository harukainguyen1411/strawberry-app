import { ref, type Ref } from 'vue'
import { db, storage } from '@/firebase/config'
import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  type Unsubscribe,
  type Timestamp
} from 'firebase/firestore'
import { ref as storageRef, uploadBytes } from 'firebase/storage'

export interface BeeJob {
  id: string
  userId: string
  type: 'comment'
  status: 'queued' | 'running' | 'done' | 'failed'
  prompt: string
  sourceStorageUri: string
  resultStorageUri: string | null
  transcriptStorageUri: string | null
  errorMessage: string | null
  createdAt: Timestamp | null
  startedAt: Timestamp | null
  completedAt: Timestamp | null
  tokenCost: number | null
  toolCalls: number | null
}

export function useBee() {
  const submitting: Ref<boolean> = ref(false)
  const submitError: Ref<string | null> = ref(null)
  const currentJob: Ref<BeeJob | null> = ref(null)
  const jobHistory: Ref<BeeJob[]> = ref([])

  async function submitJob(
    uid: string,
    file: File,
    prompt: string
  ): Promise<string> {
    submitting.value = true
    submitError.value = null

    try {
      const jobId = crypto.randomUUID()
      const storagePath = `bee/${uid}/${jobId}/input.docx`
      const storageUri = `gs://myapps-b31ea.appspot.com/${storagePath}`

      const fileRef = storageRef(storage, storagePath)
      await uploadBytes(fileRef, file, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })

      const jobRef = await addDoc(collection(db, 'jobs'), {
        userId: uid,
        type: 'comment',
        status: 'queued',
        prompt,
        sourceStorageUri: storageUri,
        resultStorageUri: null,
        transcriptStorageUri: null,
        errorMessage: null,
        createdAt: serverTimestamp(),
        startedAt: null,
        completedAt: null,
        tokenCost: null,
        toolCalls: null
      })

      return jobRef.id
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      submitError.value = message
      throw err
    } finally {
      submitting.value = false
    }
  }

  function subscribeToJob(jobId: string): Unsubscribe {
    const jobDoc = doc(db, 'jobs', jobId)
    return onSnapshot(jobDoc, (snapshot) => {
      if (snapshot.exists()) {
        currentJob.value = { id: snapshot.id, ...snapshot.data() } as BeeJob
      }
    })
  }

  function subscribeToHistory(uid: string): Unsubscribe {
    const q = query(
      collection(db, 'jobs'),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc')
    )
    return onSnapshot(q, (snapshot) => {
      jobHistory.value = snapshot.docs.map(
        (d) => ({ id: d.id, ...d.data() } as BeeJob)
      )
    })
  }

  return {
    submitting,
    submitError,
    currentJob,
    jobHistory,
    submitJob,
    subscribeToJob,
    subscribeToHistory
  }
}
