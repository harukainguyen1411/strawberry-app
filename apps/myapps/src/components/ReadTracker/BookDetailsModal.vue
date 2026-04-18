<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" @click.self="$emit('close')">
    <div class="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
      <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <h3 class="text-xl font-semibold text-gray-900">{{ book.title }}</h3>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="p-6">
        <div class="flex flex-col md:flex-row gap-6 mb-6">
          <!-- Book Cover -->
          <div class="flex-shrink-0">
            <div class="w-48 h-72 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden mx-auto md:mx-0">
              <img
                v-if="book.coverImage"
                :src="book.coverImage"
                :alt="book.title"
                class="w-full h-full object-cover"
              />
              <div v-else class="text-8xl text-gray-400">📖</div>
            </div>
          </div>

          <!-- Book Info -->
          <div class="flex-1">
            <h2 class="text-2xl font-bold text-gray-900 mb-2">{{ book.title }}</h2>
            <p class="text-lg text-gray-600 mb-4">by {{ book.author }}</p>

            <!-- Status -->
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                :value="book.status"
                @change="updateStatus($event)"
                class="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="wantToRead">Want to Read</option>
                <option value="reading">Currently Reading</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <!-- Dates -->
            <div class="space-y-3 text-sm">
              <div v-if="book.startDate">
                <span class="text-gray-600">Started:</span>
                <span class="ml-2 text-gray-900">{{ formatDate(book.startDate) }}</span>
              </div>
              <div v-if="book.completedDate">
                <span class="text-gray-600">Completed:</span>
                <span class="ml-2 text-gray-900">{{ formatDate(book.completedDate) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Reading Sessions for this Book -->
        <div class="border-t border-gray-200 pt-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Reading Sessions</h3>
          
          <div v-if="bookSessions.length === 0" class="text-center py-8 text-gray-500">
            <p>No reading sessions recorded for this book yet.</p>
            <p class="text-sm mt-2">Add a reading session and link it to this book to track your progress.</p>
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="session in bookSessions"
              :key="session.id"
              class="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div>
                <p class="font-medium text-gray-900">{{ formatDate(session.date) }}</p>
                <p class="text-sm text-gray-600">{{ formatDuration(session.duration) }} of reading</p>
              </div>
              <span class="px-3 py-1 bg-primary-100 text-primary-700 rounded-lg text-sm font-medium">
                {{ formatDuration(session.duration) }}
              </span>
            </div>
            
            <!-- Total Reading Time -->
            <div class="mt-4 p-4 bg-primary-50 rounded-lg">
              <div class="flex justify-between items-center">
                <span class="font-medium text-gray-900">Total Reading Time</span>
                <span class="text-xl font-bold text-primary-700">{{ formatDuration(totalReadingTime) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useReadingSessionsStore } from '@/stores/readingSessions'
import { useBooksStore } from '@/stores/books'
import type { Book, ReadingSession } from '@/firebase/firestore'
import { Timestamp } from 'firebase/firestore'
import { format } from 'date-fns'

interface Props {
  book: Book
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  'update-status': []
}>()

const sessionsStore = useReadingSessionsStore()
const booksStore = useBooksStore()

// Get sessions for this book
const bookSessions = computed<ReadingSession[]>(() => {
  if (!props.book.id) return []
  return sessionsStore.sessions.filter(session => session.bookId === props.book.id)
})

// Calculate total reading time
const totalReadingTime = computed(() => {
  return bookSessions.value.reduce((total, session) => total + (session.duration || 0), 0)
})

const formatDate = (timestamp: Timestamp | undefined): string => {
  if (!timestamp) return ''
  return format(timestamp.toDate(), 'MMM d, yyyy')
}

const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

const updateStatus = async (event: Event) => {
  const target = event.target as HTMLSelectElement
  const newStatus = target.value as 'reading' | 'completed' | 'wantToRead'
  
  try {
    const updates: Partial<Book> = { status: newStatus }
    
    // If marking as reading and no start date, set it
    if (newStatus === 'reading' && !props.book.startDate) {
      updates.startDate = Timestamp.now()
    }
    
    // If marking as completed, set completed date
    if (newStatus === 'completed' && !props.book.completedDate) {
      updates.completedDate = Timestamp.now()
    }
    
    if (props.book.id) {
      await booksStore.updateBookData(props.book.id, updates)
      emit('update-status')
    }
  } catch (error) {
    console.error('Error updating status:', error)
    alert('Failed to update book status. Please try again.')
  }
}
</script>
