import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  type ActionCodeSettings,
} from 'firebase/auth'
import { auth } from '../firebase/config'

const EMAIL_FOR_SIGN_IN_KEY = 'portfolioEmailForSignIn'

const actionCodeSettings: ActionCodeSettings = {
  url: `${window.location.origin}/myApps/portfolio-tracker/sign-in-callback`,
  handleCodeInApp: true,
}

export async function sendSignInLink(email: string): Promise<void> {
  await sendSignInLinkToEmail(auth, email, actionCodeSettings)
  window.localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, email)
}

export async function completeSignIn(url: string): Promise<void> {
  if (!isSignInWithEmailLink(auth, url)) return

  let email = window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY)
  if (!email) {
    // Opened on a different device — prompt for email
    email = window.prompt('Please provide your email for confirmation') ?? ''
  }

  await signInWithEmailLink(auth, email, url)
  window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY)
}

export { auth }
