<script setup lang="ts">
import LanguageSelector from '@/components/LanguageSelector.vue'
import MobileMenu from '@/components/MobileMenu.vue'
import QRCodeScan from '@/components/QRCodeScan.vue'
import QRCodeCreate from '@/components/QRCodeCreate.vue'
import AppFooter from '@/components/AppFooter.vue'
import useDarkModePreference from '@/utils/useDarkModePreference'
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { isDarkMode, isDarkModePreferenceSetBySystem, toggleDarkModePreference } =
  useDarkModePreference()

const capturedData = ref<string>('')
const qrCodeScanRef = ref<InstanceType<typeof QRCodeScan> | null>(null)

// #region Scroll-aware header
const lastScrollTop = ref(0)
const isHeaderCollapsed = ref(false)
const scrollThreshold = 50 // Scroll threshold to trigger header collapse

const handleScroll = () => {
  const currentScrollTop = document.querySelector('#app')?.scrollTop
  if (!currentScrollTop) return

  // Determine scroll direction and distance
  if (currentScrollTop > lastScrollTop.value && currentScrollTop > scrollThreshold) {
    // Scrolling down past threshold
    isHeaderCollapsed.value = true
  } else if (currentScrollTop < lastScrollTop.value || currentScrollTop < scrollThreshold) {
    // Scrolling up or at top
    isHeaderCollapsed.value = false
  }

  lastScrollTop.value = currentScrollTop
}

onMounted(() => {
  document.querySelector('#app')?.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  document.querySelector('#app')?.removeEventListener('scroll', handleScroll)
})
// #endregion

// #region App mode
enum AppMode {
  Create = 'create',
  Scan = 'scan'
}

const appMode = ref<AppMode>(AppMode.Create)
const setAppMode = (mode: AppMode) => {
  if (
    appMode.value === AppMode.Scan &&
    mode === AppMode.Create &&
    qrCodeScanRef.value?.capturedData
  ) {
    capturedData.value = qrCodeScanRef.value.capturedData
  }

  appMode.value = mode
}

const useCapturedDataInCreateMode = (data: string) => {
  capturedData.value = data
  appMode.value = AppMode.Create
}

const isModeToggleDisabled = computed(() => {
  return appMode.value === AppMode.Scan && !!qrCodeScanRef.value && !!qrCodeScanRef.value.isLoading
})
// #endregion
</script>

<template>
  <main class="flex min-h-screen flex-col pb-48 md:pb-0">
    <!-- Desktop header - only visible on desktop -->
    <div
      class="hidden md:mx-auto md:mb-6 md:mt-8 md:flex md:w-5/6 md:flex-row md:items-center md:justify-between md:px-4"
    >
      <div class="flex items-center gap-6">
        <!-- Logo -->
        <div class="flex items-center gap-2">
          <span class="size-6.5 flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-[10px] font-black text-white shadow-md shadow-blue-500/10">QR</span>
          <div class="flex flex-col items-start leading-none">
            <h1 class="bg-gradient-to-r from-zinc-800 to-zinc-600 bg-clip-text text-xl font-black tracking-tight text-transparent dark:from-zinc-100 dark:to-zinc-300">Mini-QR</h1>
            <span class="text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 mt-0.5">by Poppy</span>
          </div>
        </div>

        <!-- Mode toggle button - only visible on desktop -->
        <div
          class="bg-zinc-150/70 dark:bg-zinc-850/70 flex items-center gap-0.5 rounded-xl border border-zinc-200/50 p-0.5 shadow-sm backdrop-blur-sm dark:border-zinc-800/80"
        >
          <button
            :class="[
              'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold outline-none transition-all duration-200',
              appMode === AppMode.Create
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                : 'hover:text-zinc-850 text-zinc-500 dark:text-zinc-400 dark:hover:text-zinc-200'
            ]"
            @click="setAppMode(AppMode.Create)"
            :disabled="isModeToggleDisabled"
            :aria-label="t('Switch to Create Mode')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
            <span>{{ t('Create') }}</span>
          </button>
          <button
            :class="[
              'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold outline-none transition-all duration-200',
              appMode === AppMode.Scan
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                : 'hover:text-zinc-850 text-zinc-500 dark:text-zinc-400 dark:hover:text-zinc-200'
            ]"
            @click="setAppMode(AppMode.Scan)"
            :disabled="isModeToggleDisabled"
            :aria-label="t('Switch to Scan Mode')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span>{{ t('Scan') }}</span>
          </button>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2.5">
        <button
          class="grid size-9 place-items-center rounded-xl border border-zinc-200 bg-white text-zinc-500 outline-none transition-all hover:scale-[1.03] hover:bg-zinc-50 hover:text-zinc-800 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400 dark:hover:text-zinc-200"
          @click="toggleDarkModePreference"
          :aria-label="t('Toggle dark mode')"
        >
          <span v-if="isDarkModePreferenceSetBySystem">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2v20"/></svg>
          </span>
          <span v-else-if="isDarkMode">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
          </span>
          <span v-else>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
          </span>
        </button>
        <LanguageSelector />
      </div>
    </div>

    <!-- Mobile sticky header - only visible on mobile -->
    <div
      class="scroll-header-container fixed inset-x-0 top-0 z-50 px-4 pt-4 md:hidden"
      :class="{ 'header-collapsed': isHeaderCollapsed }"
    >
      <div class="flex justify-center">
        <div
          class="relative flex items-center gap-0.5 rounded-xl border border-zinc-200 bg-white/90 p-0.5 shadow-lg backdrop-blur-md transition-all duration-300 dark:border-zinc-800 dark:bg-zinc-900/95"
        >
          <button
            :class="[
              'flex items-center gap-1 rounded-lg px-3.5 py-1 text-xs font-bold outline-none transition-all duration-200',
              appMode === AppMode.Create
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400',
              isHeaderCollapsed ? 'py-0.5 text-[10px]' : 'py-1 text-xs'
            ]"
            @click="setAppMode(AppMode.Create)"
            :disabled="isModeToggleDisabled"
            :aria-label="t('Switch to Create Mode')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" :width="isHeaderCollapsed ? 12 : 14" :height="isHeaderCollapsed ? 12 : 14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
            <span>{{ t('Create') }}</span>
          </button>
          <button
            :class="[
              'flex items-center gap-1 rounded-lg px-3.5 py-1 text-xs font-bold outline-none transition-all duration-200',
              appMode === AppMode.Scan
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400',
              isHeaderCollapsed ? 'py-0.5 text-[10px]' : 'py-1 text-xs'
            ]"
            @click="setAppMode(AppMode.Scan)"
            :disabled="isModeToggleDisabled"
            :aria-label="t('Switch to Scan Mode')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" :width="isHeaderCollapsed ? 12 : 14" :height="isHeaderCollapsed ? 12 : 14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span>{{ t('Scan') }}</span>
          </button>

          <!-- Hamburger menu -->
          <MobileMenu
            :isDarkMode="isDarkMode"
            :isDarkModePreferenceSetBySystem="isDarkModePreferenceSetBySystem"
            @toggle-dark-mode="toggleDarkModePreference"
          />
        </div>
      </div>
    </div>

    <div
      class="grid w-full flex-1 place-items-center items-start bg-transparent p-6 pb-12 pt-24 md:p-8"
    >
      <!-- Main content area with conditional rendering based on app mode -->
      <div class="w-full lg:w-5/6">
        <div v-if="appMode === AppMode.Create">
          <QRCodeCreate :initial-data="capturedData" />
        </div>
        <div v-else class="flex flex-col items-center justify-center py-4">
          <QRCodeScan ref="qrCodeScanRef" @create-qr="useCapturedDataInCreateMode" />
        </div>
      </div>
    </div>
    <AppFooter />
  </main>
</template>

<style lang="postcss" scoped>
.vertical-border {
  @apply h-8 w-1 bg-slate-300 dark:bg-slate-700;
}

.icon-button {
  @apply p-1;
  @apply rounded-sm outline-none hover:shadow focus-visible:ring-1 focus-visible:ring-zinc-700 dark:focus-visible:ring-zinc-200;
  @apply text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100;
}

.button {
  @apply bg-zinc-100 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-200;
  @apply rounded-lg p-2 shadow-sm hover:shadow focus-visible:shadow-md;
  @apply outline-none focus-visible:ring-1 focus-visible:ring-zinc-700 dark:focus-visible:ring-zinc-200;
  @apply disabled:cursor-not-allowed disabled:opacity-50;
}

/* Scroll-aware header styles */
.scroll-header-container {
  transition: transform 0.3s ease;
}

.header-collapsed {
  transform: translateY(-40%);
}

.header-collapsed button {
  transition: all 0.3s ease;
}
</style>
