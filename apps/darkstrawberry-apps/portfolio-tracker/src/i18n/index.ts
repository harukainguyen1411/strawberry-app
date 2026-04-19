import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import vi from './locales/vi.json'

// Get saved language from localStorage or default to 'en'
const savedLocale = localStorage.getItem('preferredLanguage') || 'en'

export const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'en',
  messages: {
    en,
    vi
  }
})

export default i18n
