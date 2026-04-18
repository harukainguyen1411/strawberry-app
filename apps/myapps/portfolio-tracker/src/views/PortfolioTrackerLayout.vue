<template>
  <div class="w-full">
    <LocalModeWarning />
    
    <div class="mb-4 sm:mb-6 lg:mb-8">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">{{ $t('portfolioTracker.title') }}</h1>
      <p class="text-sm sm:text-base text-gray-600">{{ $t('portfolioTracker.subtitle') }}</p>
    </div>
    
    <nav class="flex gap-1 sm:gap-2 mb-4 sm:mb-6 lg:mb-8 border-b-2 border-gray-200 overflow-x-auto scrollbar-hide -mx-3 sm:mx-0 px-3 sm:px-0" :key="locale">
      <router-link
        v-for="item in navItems"
        :key="item.route"
        :to="item.route"
        class="px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-gray-600 font-medium border-b-2 border-transparent -mb-0.5 transition-colors hover:text-primary-600 whitespace-nowrap touch-manipulation"
        active-class="text-primary-600 border-primary-600"
      >
        {{ item.label }}
      </router-link>
    </nav>

    <div class="min-h-[400px]">
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import LocalModeWarning from '@/components/common/LocalModeWarning.vue'

interface NavItem {
  label: string
  route: string
}

const i18n = useI18n()
const { t, locale } = i18n

const navItems = computed<NavItem[]>(() => [
  { label: t('portfolioTracker.dashboard'), route: '/portfolio-tracker/dashboard' },
  { label: t('portfolioTracker.transactions'), route: '/portfolio-tracker/transactions' },
  { label: t('portfolioTracker.settings'), route: '/portfolio-tracker/settings' }
])
</script>

<style scoped>
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
