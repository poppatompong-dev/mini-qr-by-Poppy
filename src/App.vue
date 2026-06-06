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
          <span class="flex size-7 items-center justify-center rounded-[6px] bg-[var(--accent-blue)] text-[9px] font-extrabold tracking-wider text-white shadow-[0_2px_8px_rgba(29,78,216,0.25)] dark:bg-[var(--accent-blue)]">QR</span>
          <div class="flex flex-col items-start leading-none">
            <div class="flex items-center gap-1.5">
              <h1 class="text-lg font-bold tracking-[-0.03em] text-[var(--text-primary)]">MiniQR</h1>
              <span class="bg-[var(--accent-gold)]/20 dark:bg-[var(--accent-gold)]/10 rounded px-1 py-0.5 text-[8px] font-bold text-[oklch(60%_0.04_80)] dark:text-[var(--accent-gold)]">PRO</span>
            </div>
            <span class="mt-0.5 text-[9px] font-semibold text-zinc-400 dark:text-zinc-500">by Poppy</span>
          </div>
        </div>

        <!-- Mode toggle button - only visible on desktop -->
        <div
          class="relative flex w-[160px] items-center gap-0.5 rounded-xl border border-zinc-200/60 bg-zinc-100/80 p-1 shadow-sm backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/60"
        >
          <!-- Sliding Indicator Pill -->
          <div
            class="duration-350 absolute inset-y-1 rounded-lg bg-white shadow-sm transition-all dark:bg-zinc-800"
            :style="{
              left: appMode === AppMode.Create ? '4px' : 'calc(50% + 1.5px)',
              width: 'calc(50% - 5.5px)',
              transitionTimingFunction: 'var(--ease-out-expo)'
            }"
          ></div>

          <button
            :class="[
              'relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold outline-none transition-colors duration-300',
              appMode === AppMode.Create
                ? 'text-zinc-900 dark:text-zinc-100'
                : 'hover:text-zinc-650 text-zinc-400 dark:hover:text-zinc-300'
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
              'relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold outline-none transition-colors duration-300',
              appMode === AppMode.Scan
                ? 'text-zinc-900 dark:text-zinc-100'
                : 'hover:text-zinc-650 text-zinc-400 dark:hover:text-zinc-300'
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
          class="dark-toggle-btn grid size-9 place-items-center rounded-xl border border-zinc-200 bg-white text-zinc-500 outline-none transition-all duration-300 hover:scale-105 hover:bg-zinc-50 hover:text-zinc-800 active:scale-[0.95] dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400 dark:hover:text-zinc-200"
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
          class="duration-350 relative flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-white/95 p-1 pr-2 shadow-lg backdrop-blur-md transition-all dark:border-zinc-800 dark:bg-zinc-900/95"
        >
          <!-- Switcher buttons container with sliding pill -->
          <div class="relative flex w-[160px] items-center gap-0.5 rounded-lg bg-zinc-100/50 p-0.5 dark:bg-zinc-800/40">
            <div
              class="duration-350 absolute inset-y-0.5 rounded-[6px] bg-white shadow-sm transition-all dark:bg-zinc-700"
              :style="{
                left: appMode === AppMode.Create ? '2px' : 'calc(50% + 1px)',
                width: 'calc(50% - 3px)',
                transitionTimingFunction: 'var(--ease-out-expo)'
              }"
            ></div>

            <button
              :class="[
                'relative z-10 flex flex-1 items-center justify-center gap-1 rounded-[6px] py-1 text-xs font-bold outline-none transition-colors duration-300',
                appMode === AppMode.Create
                  ? 'text-zinc-900 dark:text-zinc-100'
                  : 'text-zinc-400 dark:text-zinc-400',
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
                'relative z-10 flex flex-1 items-center justify-center gap-1 rounded-[6px] py-1 text-xs font-bold outline-none transition-colors duration-300',
                appMode === AppMode.Scan
                  ? 'text-zinc-900 dark:text-zinc-100'
                  : 'text-zinc-400 dark:text-zinc-400',
                isHeaderCollapsed ? 'py-0.5 text-[10px]' : 'py-1 text-xs'
              ]"
              @click="setAppMode(AppMode.Scan)"
              :disabled="isModeToggleDisabled"
              :aria-label="t('Switch to Scan Mode')"
            >
              <svg xmlns="http://www.w3.org/2000/svg" :width="isHeaderCollapsed ? 12 : 14" :height="isHeaderCollapsed ? 12 : 14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              <span>{{ t('Scan') }}</span>
            </button>
          </div>

          <!-- Divider line -->
          <span class="h-5 w-px bg-zinc-200 dark:bg-zinc-800"></span>

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

/* Theme toggle button spin hover */
.dark-toggle-btn svg {
  transition: transform 0.5s var(--ease-out-expo);
}

.dark-toggle-btn:hover svg {
  transform: rotate(45deg) scale(1.08);
}
</style>
