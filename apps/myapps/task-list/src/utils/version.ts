/**
 * Version tracking utility
 * Provides app version information from package.json and release metadata
 */

import { marked } from 'marked'

// Version will be injected by Vite during build
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0'
export const RELEASE_TIME = import.meta.env.VITE_RELEASE_TIME || new Date().toISOString()
export const RELEASE_NOTES = import.meta.env.VITE_RELEASE_NOTES || ''

export interface VersionInfo {
  version: string
  releaseTime: string
  releaseDate: string
  releaseNotes: string
}

/**
 * Get complete version information
 */
export function getVersionInfo(): VersionInfo {
  const releaseDate = new Date(RELEASE_TIME).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  return {
    version: APP_VERSION,
    releaseTime: RELEASE_TIME,
    releaseDate,
    releaseNotes: RELEASE_NOTES
  }
}

/**
 * Get formatted version string for display
 */
export function getVersionString(): string {
  return `v${APP_VERSION}`
}

/**
 * Get formatted version with release date
 */
export function getVersionWithReleaseDate(): string {
  const info = getVersionInfo()
  return `${getVersionString()} (Released: ${info.releaseDate})`
}

/**
 * Get release notes formatted for display
 * Renders markdown to HTML
 */
export function getFormattedReleaseNotes(): string {
  if (!RELEASE_NOTES) return ''
  // Convert escaped newlines to actual newlines
  const notes = RELEASE_NOTES.replace(/\\n/g, '\n')
  // Render markdown to HTML
  return marked.parse(notes) as string
}
