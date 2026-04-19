import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import { getBooks as getBooksFirebase, addBook as addBookFirebase, updateBook as updateBookFirebase, deleteBook as deleteBookFirebase, type Book } from '@/firebase/firestore'
import { getBooks as getBooksLocal, addBook as addBookLocal, updateBook as updateBookLocal, deleteBook as deleteBookLocal } from '@/storage/localStorage'
import { useAuthStore } from './auth'
import type { DocumentReference, DocumentData } from 'firebase/firestore'

export const useBooksStore = defineStore('books', () => {
  const books: Ref<Book[]> = ref([])
  const loading: Ref<boolean> = ref(false)
  const error: Ref<string | null> = ref(null)

  const fetchBooks = async (): Promise<void> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return

    loading.value = true
    error.value = null
    try {
      if (authStore.localMode) {
        books.value = await getBooksLocal()
      } else if (authStore.user) {
        books.value = await getBooksFirebase(authStore.user.uid)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load books'
      error.value = errorMessage
      console.error('Error fetching books:', err)
    } finally {
      loading.value = false
    }
  }

  const createBook = async (bookData: Omit<Book, 'id' | 'createdAt'>): Promise<DocumentReference<DocumentData> | { id: string }> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) throw new Error('User not authenticated')

    error.value = null
    try {
      let docRef: DocumentReference<DocumentData> | { id: string }
      if (authStore.localMode) {
        docRef = await addBookLocal(bookData)
      } else if (authStore.user) {
        docRef = await addBookFirebase(authStore.user.uid, bookData)
      } else {
        throw new Error('User not authenticated')
      }
      await fetchBooks() // Refresh list
      return docRef
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create book'
      error.value = errorMessage
      console.error('Error creating book:', err)
      throw err
    }
  }

  const updateBookData = async (bookId: string, updates: Partial<Book>): Promise<void> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) throw new Error('User not authenticated')

    error.value = null
    try {
      if (authStore.localMode) {
        await updateBookLocal(bookId, updates)
      } else if (authStore.user) {
        await updateBookFirebase(authStore.user.uid, bookId, updates)
      } else {
        throw new Error('User not authenticated')
      }
      await fetchBooks() // Refresh list
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update book'
      error.value = errorMessage
      console.error('Error updating book:', err)
      throw err
    }
  }

  const removeBook = async (bookId: string): Promise<void> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) throw new Error('User not authenticated')

    error.value = null
    try {
      if (authStore.localMode) {
        await deleteBookLocal(bookId)
      } else if (authStore.user) {
        await deleteBookFirebase(authStore.user.uid, bookId)
      } else {
        throw new Error('User not authenticated')
      }
      await fetchBooks() // Refresh list
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete book'
      error.value = errorMessage
      console.error('Error deleting book:', err)
      throw err
    }
  }

  return {
    books,
    loading,
    error,
    fetchBooks,
    createBook,
    updateBookData,
    removeBook
  }
})
