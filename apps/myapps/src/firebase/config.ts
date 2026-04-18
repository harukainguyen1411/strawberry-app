import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'
import { getAnalytics, type Analytics, isSupported } from 'firebase/analytics'
import { getRemoteConfig, type RemoteConfig } from 'firebase/remote-config'
import { remoteConfigDefaults } from './remoteConfigDefaults'

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
}

// Validate that all required environment variables are set
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error(
    'Missing Firebase configuration. Please check your .env file and ensure all VITE_FIREBASE_* variables are set.'
  )
}

// Initialize Firebase
const app: FirebaseApp = initializeApp(firebaseConfig)

// Initialize Firebase services
export const auth: Auth = getAuth(app)
export const db: Firestore = getFirestore(app)
export const storage: FirebaseStorage = getStorage(app)

// Initialize Remote Config
export const remoteConfig: RemoteConfig = getRemoteConfig(app)
// Short interval for dev (10s), 1 hour for prod
remoteConfig.settings.minimumFetchIntervalMillis = import.meta.env.DEV ? 10_000 : 3_600_000
remoteConfig.defaultConfig = remoteConfigDefaults

// Initialize Analytics (only in browser environment and if supported)
let analytics: Analytics | null = null
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app)
    }
  })
}

export { analytics }
export default app
