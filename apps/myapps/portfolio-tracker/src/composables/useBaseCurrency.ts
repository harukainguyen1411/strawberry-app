/**
 * useBaseCurrency — composable to read and set the user's base currency.
 *
 * Reads `users/{uid}.baseCurrency` from Firestore. On first sign-in, the
 * field is unset — callers check `baseCurrency.value === null` to show the
 * BaseCurrencyPicker modal.
 *
 * Refs V0.10
 */

import { ref, watch } from 'vue'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { useAuth } from '@/composables/useAuth'
import type { CurrencyCode } from '@/types/firestore'

const _baseCurrency = ref<CurrencyCode | null>(null)
const _loading = ref(false)

export function useBaseCurrency() {
  const { uid } = useAuth()

  /**
   * Load baseCurrency for the current user whenever uid changes.
   */
  async function loadBaseCurrency(userId: string | null) {
    if (!userId) {
      _baseCurrency.value = null
      return
    }
    _loading.value = true
    try {
      const userDoc = await getDoc(doc(db, 'users', userId))
      if (userDoc.exists()) {
        const data = userDoc.data()
        _baseCurrency.value = (data?.baseCurrency as CurrencyCode) ?? null
      } else {
        _baseCurrency.value = null
      }
    } catch (err) {
      console.warn('[useBaseCurrency] Failed to load baseCurrency:', err)
      _baseCurrency.value = null
    } finally {
      _loading.value = false
    }
  }

  // Re-load when uid changes (sign-in / sign-out)
  watch(uid, (newUid) => loadBaseCurrency(newUid), { immediate: true })

  /**
   * Write the chosen currency to Firestore and update local state.
   */
  async function setBaseCurrency(currency: CurrencyCode): Promise<void> {
    const userId = uid.value
    if (!userId) throw new Error('Not authenticated')
    _loading.value = true
    try {
      await setDoc(doc(db, 'users', userId), { baseCurrency: currency }, { merge: true })
      _baseCurrency.value = currency
    } finally {
      _loading.value = false
    }
  }

  return {
    baseCurrency: _baseCurrency,
    setBaseCurrency,
    loading: _loading,
  }
}
