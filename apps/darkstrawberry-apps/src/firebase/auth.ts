import { auth } from './config'
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  onAuthStateChanged,
  type User,
  type Unsubscribe
} from 'firebase/auth'

const googleProvider = new GoogleAuthProvider()
// Force account selection every time
googleProvider.setCustomParameters({
  prompt: 'select_account'
})

export const signInWithGoogle = async (): Promise<User> => {
  try {
    const result = await signInWithPopup(auth, googleProvider)
    return result.user
  } catch (error) {
    console.error('Error signing in with Google:', error)
    throw error
  }
}

export const logout = async (): Promise<void> => {
  try {
    await signOut(auth)
  } catch (error) {
    console.error('Error signing out:', error)
    throw error
  }
}

export const getCurrentUser = (): User | null => {
  return auth.currentUser
}

export const onAuthChange = (callback: (user: User | null) => void): Unsubscribe => {
  return onAuthStateChanged(auth, callback)
}
