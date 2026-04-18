<template>
  <div class="relative" ref="dropdownRef">
    <button
      @click="toggleDropdown"
      class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-sm sm:text-base text-gray-700"
      :aria-label="$t('language.selectLanguage')"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
      <span class="hidden sm:inline">{{ currentLanguageName }}</span>
      <svg
        class="w-4 h-4 text-gray-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>

    <!-- Dropdown Menu -->
    <div
      v-if="showDropdown"
      class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
    >
      <button
        v-for="lang in languages"
        :key="lang.code"
        @click="changeLanguage(lang.code)"
        :class="[
          'w-full text-left px-4 py-2 text-sm transition-colors',
          currentLocale === lang.code
            ? 'bg-primary-50 text-primary-700 font-medium'
            : 'text-gray-700 hover:bg-gray-100'
        ]"
      >
        {{ lang.name }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useClickOutside } from '@/composables/useClickOutside'

const { locale } = useI18n()
const showDropdown = ref(false)
const dropdownRef = ref<HTMLElement>()

const languages = [
  { code: 'en', name: 'English' },
  { code: 'vi', name: 'Tiếng Việt' }
]

const currentLocale = computed(() => locale.value)

const currentLanguageName = computed(() => {
  const lang = languages.find(l => l.code === currentLocale.value)
  return lang?.name || 'English'
})

const toggleDropdown = (): void => {
  showDropdown.value = !showDropdown.value
}

const closeDropdown = (): void => {
  showDropdown.value = false
}

const changeLanguage = (langCode: string): void => {
  locale.value = langCode
  localStorage.setItem('preferredLanguage', langCode)
  closeDropdown()
}

useClickOutside(dropdownRef, closeDropdown)
</script>
