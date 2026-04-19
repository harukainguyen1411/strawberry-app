<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <div class="bg-white rounded-lg shadow p-4 sm:p-6">
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
        <h2 class="text-xl sm:text-2xl font-semibold text-gray-900">{{ $t('books.title') }}</h2>
        <button
          @click="showForm = true"
          class="bg-primary-600 text-white px-4 py-2.5 sm:py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base touch-manipulation"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>{{ $t('books.addBook') }}</span>
        </button>
      </div>
    </div>

    <!-- Book Form Modal -->
    <BookForm
      v-if="showForm"
      :book="editingBook"
      @close="handleFormClose"
      @save="handleSaveBook"
    />

    <!-- Status Filter Tabs -->
    <div class="bg-white rounded-lg shadow">
      <div class="border-b border-gray-200 overflow-x-auto scrollbar-hide" :key="locale">
        <nav class="flex -mb-px min-w-max">
          <button
            v-for="status in statusFilters"
            :key="status.value"
            @click="activeFilter = status.value"
            :class="[
              'px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium border-b-2 transition-colors touch-manipulation',
              activeFilter === status.value
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]"
          >
            {{ status.label }}
            <span class="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
              {{ getBooksByStatus(status.value).length }}
            </span>
          </button>
        </nav>
      </div>

      <!-- Error State -->
      <div v-if="booksStore.error && !booksStore.loading" class="p-4 sm:p-6 bg-red-50 border border-red-200 rounded-lg mx-4 sm:mx-6 my-4">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div class="flex-1">
            <p class="text-sm font-medium text-red-800">{{ $t('books.errorLoading') }}</p>
            <p class="text-xs sm:text-sm text-red-600 mt-1">{{ booksStore.error }}</p>
            <button
              @click="booksStore.fetchBooks()"
              class="mt-2 text-xs sm:text-sm text-red-700 underline hover:text-red-800"
            >
              {{ $t('common.tryAgain') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="booksStore.loading" class="p-8 sm:p-12 text-center">
        <div class="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p class="text-sm sm:text-base text-gray-600">{{ $t('books.loadingBooks') }}</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredBooks.length === 0" class="p-8 sm:p-12 text-center">
        <div class="text-5xl sm:text-6xl mb-4">📚</div>
        <p class="text-gray-600 text-base sm:text-lg mb-2">{{ $t('books.noBooks') }}</p>
        <p class="text-gray-500 text-sm">{{ $t('books.noBooksDesc') }}</p>
      </div>

      <!-- Books Grid -->
      <div v-else class="p-3 sm:p-4 lg:p-6">
        <div class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          <div
            v-for="book in filteredBooks"
            :key="book.id"
            class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
            @click="viewBookDetails(book)"
          >
            <!-- Book Cover -->
            <div class="aspect-[2/3] bg-gray-100 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
              <img
                v-if="book.coverImage"
                :src="book.coverImage"
                :alt="book.title"
                class="w-full h-full object-cover"
              />
              <div v-else class="text-6xl text-gray-400">📖</div>
            </div>

            <!-- Book Info -->
            <div>
              <h3 class="font-semibold text-gray-900 mb-1 line-clamp-2">{{ book.title }}</h3>
              <p class="text-sm text-gray-600 mb-3">{{ book.author }}</p>
              
              <!-- Status Badge -->
              <div class="flex items-center justify-between">
                <span
                  :class="[
                    'px-2 py-1 text-xs font-medium rounded',
                    getStatusClass(book.status)
                  ]"
                >
                  {{ formatStatus(book.status) }}
                </span>
                
                <!-- Actions -->
                <div class="flex gap-1">
                  <button
                    @click.stop="editBook(book)"
                    class="p-1.5 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                    title="Edit book"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    @click.stop="deleteBook(book.id!)"
                    class="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete book"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Book Details Modal -->
    <BookDetailsModal
      v-if="selectedBook"
      :book="selectedBook"
      @close="selectedBook = null"
      @update-status="handleStatusUpdate"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBooksStore } from '@/stores/books'
import { useReadingSessionsStore } from '@/stores/readingSessions'
import BookForm from '@/components/ReadTracker/BookForm.vue'
import BookDetailsModal from '@/components/ReadTracker/BookDetailsModal.vue'
import type { Book } from '@/firebase/firestore'

const { t, locale } = useI18n()

const booksStore = useBooksStore()
const sessionsStore = useReadingSessionsStore()

const showForm = ref(false)
const editingBook = ref<Book | null>(null)
const selectedBook = ref<Book | null>(null)
const activeFilter = ref<'all' | 'reading' | 'completed' | 'wantToRead'>('all')

const statusFilters = computed(() => [
  { label: t('books.all'), value: 'all' as const },
  { label: t('books.reading'), value: 'reading' as const },
  { label: t('books.completed'), value: 'completed' as const },
  { label: t('books.wantToRead'), value: 'wantToRead' as const }
])

// Fetch data on mount
onMounted(async () => {
  await booksStore.fetchBooks()
  await sessionsStore.fetchSessions()
})

// Filter books by status
const getBooksByStatus = (status: string) => {
  if (status === 'all') return booksStore.books
  return booksStore.books.filter(book => book.status === status)
}

const filteredBooks = computed(() => {
  return getBooksByStatus(activeFilter.value)
})

const editBook = (book: Book) => {
  editingBook.value = { ...book }
  showForm.value = true
}

const viewBookDetails = (book: Book) => {
  selectedBook.value = book
}

const handleFormClose = () => {
  showForm.value = false
  editingBook.value = null
}

const handleSaveBook = async () => {
  showForm.value = false
  editingBook.value = null
  await booksStore.fetchBooks()
}

const handleStatusUpdate = async () => {
  await booksStore.fetchBooks()
}

const deleteBook = async (bookId: string) => {
  if (confirm(t('books.deleteConfirm'))) {
    try {
      await booksStore.removeBook(bookId)
    } catch (error) {
      console.error('Error deleting book:', error)
      alert(t('books.deleteError'))
    }
  }
}

const formatStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    reading: t('books.status.reading'),
    completed: t('books.status.completed'),
    wantToRead: t('books.status.wantToRead')
  }
  return statusMap[status] || status
}

const getStatusClass = (status: string): string => {
  const classes: Record<string, string> = {
    reading: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    wantToRead: 'bg-gray-100 text-gray-800'
  }
  return classes[status] || 'bg-gray-100 text-gray-800'
}
</script>
