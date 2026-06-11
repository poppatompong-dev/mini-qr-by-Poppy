<script setup lang="ts">
import LanguageSelector from '@/components/LanguageSelector.vue'
import MobileMenu from '@/components/MobileMenu.vue'
import QRCodeScan from '@/components/QRCodeScan.vue'
import QRCodeCreate from '@/components/QRCodeCreate.vue'
import FileShareView from '@/components/FileShareView.vue'
import AppFooter from '@/components/AppFooter.vue'
import useDarkModePreference from '@/utils/useDarkModePreference'
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { isDarkMode, isDarkModePreferenceSetBySystem, toggleDarkModePreference } =
  useDarkModePreference()

const capturedData = ref<string>('')
const qrCodeScanRef = ref<InstanceType<typeof QRCodeScan> | null>(null)
const showUserGuide = ref(false)
const toggleUserGuide = () => {
  showUserGuide.value = !showUserGuide.value
}

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

const shareId = ref<string | null>(null)

onMounted(() => {
  document.querySelector('#app')?.addEventListener('scroll', handleScroll)

  // Check for share query parameter ?id=UUID
  const urlParams = new URLSearchParams(window.location.search)
  const idParam = urlParams.get('id')
  if (idParam) {
    shareId.value = idParam
    appMode.value = AppMode.Share
  }
})

onUnmounted(() => {
  document.querySelector('#app')?.removeEventListener('scroll', handleScroll)
})
// #endregion

// #region App mode
enum AppMode {
  Create = 'create',
  Scan = 'scan',
  Share = 'share'
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
  <main class="relative flex min-h-screen flex-col overflow-x-hidden pb-48 md:pb-0">
    <!-- Ambient luxury background mesh -->
    <div class="ambient-luxury-mesh"></div>

    <!-- Desktop header - only visible on desktop -->
    <div
      class="hidden md:mx-auto md:my-8 md:flex md:w-5/6 md:flex-row md:items-center md:justify-between md:px-4"
    >
      <div class="flex items-center gap-6">
        <!-- Logo -->
        <div class="flex items-center gap-3">
          <span class="border-[var(--accent-gold)]/30 flex size-9 items-center justify-center rounded-lg border bg-[var(--primary)] text-[10px] font-extrabold tracking-wider text-[var(--primary-foreground)] shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" class="size-4 text-[var(--accent-gold)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </span>
          <div class="flex flex-col items-start leading-none">
            <div class="flex items-center gap-2">
              <h1 class="text-xl font-bold tracking-tight text-[var(--text-primary)]">MiniQR</h1>
              <span class="bg-[var(--accent-gold)]/10 border-[var(--accent-gold)]/30 rounded border px-1.5 py-0.5 text-[7px] font-bold tracking-widest text-[var(--accent-gold)]">GOV PRO</span>
            </div>
            <span class="text-zinc-550 mt-1 text-[9px] font-medium dark:text-zinc-400">เทศบาลนครนครสวรรค์ (Nakhon Sawan Municipality)</span>
          </div>
        </div>

        <!-- Mode toggle button - only visible on desktop -->
        <div
          class="relative flex w-[170px] items-center gap-0.5 rounded-xl border border-[var(--border-zinc)] bg-white/60 p-1 shadow-sm backdrop-blur-md dark:bg-zinc-900/60"
        >
          <!-- Sliding Indicator Pill -->
          <div
            class="duration-350 border-[var(--accent-gold)]/20 absolute inset-y-1 rounded-lg border bg-[var(--primary)] shadow-sm transition-all"
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
                ? 'text-[var(--primary-foreground)]'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
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
                ? 'text-[var(--primary-foreground)]'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
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

      <div class="flex items-center justify-end gap-3">
        <!-- User Guide Toggle Button -->
        <button
          class="grid size-9 place-items-center rounded-xl border outline-none transition-all duration-300 hover:scale-105 active:scale-[0.95]"
          :class="showUserGuide 
            ? 'border-[var(--accent-gold)] text-[var(--accent-gold)] bg-[var(--accent-gold)]/10' 
            : 'border-[var(--border-zinc)] bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400 dark:hover:text-zinc-200'"
          @click="toggleUserGuide"
          :title="t('User Guide')"
          :aria-label="t('User Guide')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </button>

        <button
          class="dark-toggle-btn grid size-9 place-items-center rounded-xl border border-[var(--border-zinc)] bg-white text-zinc-500 outline-none transition-all duration-300 hover:scale-105 hover:bg-zinc-50 hover:text-zinc-800 active:scale-[0.95] dark:bg-zinc-900/50 dark:text-zinc-400 dark:hover:text-zinc-200"
          @click="toggleDarkModePreference"
          :aria-label="t('Toggle dark mode')"
        >
          <span v-if="isDarkModePreferenceSetBySystem">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2v20"/></svg>
          </span>
          <span v-if="!isDarkModePreferenceSetBySystem && isDarkMode">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
          </span>
          <span v-if="!isDarkModePreferenceSetBySystem && !isDarkMode">
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
          class="duration-350 relative flex items-center gap-2 rounded-xl border border-[var(--border-zinc)] bg-white/95 p-1 pr-2 shadow-lg backdrop-blur-md transition-all dark:bg-zinc-900/95"
        >
          <!-- Switcher buttons container with sliding pill -->
          <div class="relative flex w-[160px] items-center gap-0.5 rounded-lg bg-zinc-100/50 p-0.5 dark:bg-zinc-800/40">
            <div
              class="duration-350 border-[var(--accent-gold)]/20 absolute inset-y-0.5 rounded-[6px] border bg-[var(--primary)] shadow-sm transition-all"
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
                  ? 'text-[var(--primary-foreground)]'
                  : 'text-zinc-500 dark:text-zinc-400',
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
                  ? 'text-[var(--primary-foreground)]'
                  : 'text-zinc-500 dark:text-zinc-400',
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

          <!-- Mobile User Guide Toggle Button -->
          <button
            class="grid size-7 place-items-center rounded-lg border outline-none transition-all duration-300 active:scale-[0.95]"
            :class="showUserGuide 
              ? 'border-[var(--accent-gold)] text-[var(--accent-gold)] bg-[var(--accent-gold)]/10' 
              : 'border-[var(--border-zinc)] bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400 dark:hover:text-zinc-200'"
            @click="toggleUserGuide"
            :title="t('User Guide')"
            :aria-label="t('User Guide')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </button>

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

    <!-- Main Container -->
    <div
      class="grid w-full flex-1 place-items-center items-start bg-transparent p-6 pb-20 pt-24 md:p-8"
    >
      <div class="w-full lg:w-5/6">
        <!-- 1. Luxury Hero Section (Visible in Create and Scan Modes) -->
        <section 
          v-if="appMode === AppMode.Create || appMode === AppMode.Scan"
          class="mb-10 text-center md:mb-12"
        >
          <!-- Elegant Top Badge -->
          <div class="border-[var(--accent-gold)]/35 bg-[var(--accent-gold)]/5 dark:bg-[var(--accent-gold)]/10 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--accent-gold)] shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span>{{ t('ระบบประมวลผลบนบราวเซอร์ ปลอดภัยและเป็นความลับ') || 'ระบบประมวลผลบนบราวเซอร์ ปลอดภัยและเป็นความลับ' }}</span>
          </div>

          <!-- Luxury Typography Heading -->
          <h2 class="mt-4 text-3xl font-black tracking-tight text-[var(--text-primary)] sm:text-4xl md:text-5xl">
            {{ t('ระบบสร้างรหัส QR Code และบริการแชร์ไฟล์') || 'ระบบสร้างรหัส QR Code และบริการแชร์ไฟล์' }}
          </h2>
          
          <!-- Subtle Accent Gold Line -->
          <div class="mx-auto my-4 h-0.5 w-16 rounded bg-gradient-to-r from-transparent via-[var(--accent-gold)] to-transparent"></div>

          <!-- Professional Subtext -->
          <p class="text-zinc-550 mx-auto max-w-2xl text-sm leading-relaxed dark:text-zinc-400 sm:text-base">
            {{ t('พัฒนาขึ้นอย่างเป็นทางการสำหรับบุคลากรหน่วยงานและประชาชน เพื่อความน่าเชื่อถือ รวดเร็ว และเป็นมืออาชีพ มั่นใจในระบบการบีบอัดไฟล์และส่งข้อมูลสาธารณะ') || 'พัฒนาขึ้นอย่างเป็นทางการสำหรับบุคลากรหน่วยงานและประชาชน เพื่อความน่าเชื่อถือ รวดเร็ว และเป็นมืออาชีพ มั่นใจในระบบการบีบอัดไฟล์และส่งข้อมูลสาธารณะ' }}
          </p>

          <!-- Quick Actions Grid -->
          <div class="mt-6 flex flex-wrap justify-center gap-3">
            <button
              @click="setAppMode(AppMode.Create)"
              class="btn-gold-gradient flex items-center gap-2 rounded-xl px-7 py-3 text-xs font-bold shadow-md hover:scale-105 active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              <span>สร้าง QR</span>
            </button>
            <button
              @click="setAppMode(AppMode.Scan)"
              class="btn-gold-outline flex items-center gap-2 rounded-xl px-7 py-3 text-xs font-bold shadow-sm hover:scale-105 active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              <span>แชร์ไฟล์</span>
            </button>
          </div>
        </section>

        <!-- 2. Conditional Rendering for Main Functional Area -->
        <div class="w-full">
          <div v-if="appMode === AppMode.Create">
            <QRCodeCreate :initial-data="capturedData" :show-user-guide="showUserGuide" />
          </div>
          <div v-else-if="appMode === AppMode.Share && shareId">
            <FileShareView :share-id="shareId" />
          </div>
          <div v-else class="flex flex-col items-center justify-center py-4">
            <QRCodeScan ref="qrCodeScanRef" @create-qr="useCapturedDataInCreateMode" />
          </div>
        </div>

        <!-- 3. Government / Agency Presentation Section -->
        <section 
          v-if="appMode === AppMode.Create || appMode === AppMode.Scan"
          class="mt-14 border-t border-[var(--border-zinc)] pt-12 text-center md:mt-20"
        >
          <h3 class="text-xs font-bold uppercase tracking-widest text-[var(--accent-gold)]">
            {{ t('ความปลอดภัยและบริการสาธารณะดิจิทัล') || 'ความปลอดภัยและบริการสาธารณะดิจิทัล' }}
          </h3>
          <h4 class="mt-2 text-2xl font-black text-[var(--text-primary)]">
            {{ t('ทำไมบุคลากรภาครัฐจึงเลือกใช้งานระบบ MiniQR Pro') || 'ทำไมบุคลากรภาครัฐจึงเลือกใช้งานระบบ MiniQR Pro' }}
          </h4>
          
          <div class="mt-8 grid grid-cols-1 gap-6 text-left md:grid-cols-3">
            <!-- Card 1 -->
            <div class="rounded-xl border border-[var(--border-zinc)] bg-white/50 p-6 shadow-sm dark:bg-zinc-900/30">
              <div class="mb-4 flex size-10 items-center justify-center rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]">
                <svg xmlns="http://www.w3.org/2000/svg" class="size-5 text-[var(--accent-gold)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <h5 class="text-sm font-bold text-[var(--text-primary)]">{{ t('ความปลอดภัยระดับสูง (Client-Side)') || 'ความปลอดภัยระดับสูง (Client-Side)' }}</h5>
              <p class="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                {{ t('การประมวลผลข้อมูล QR ทั้งหมดทำบนเว็บบราวเซอร์ของผู้ใช้โดยตรง ปลอดภัยจากการดักจับข้อมูลและการรั่วไหลของเอกสารราชการ') || 'การประมวลผลข้อมูล QR ทั้งหมดทำบนเว็บบราวเซอร์ของผู้ใช้โดยตรง ปลอดภัยจากการดักจับข้อมูลและการรั่วไหลของเอกสารราชการ' }}
              </p>
            </div>

            <!-- Card 2 -->
            <div class="rounded-xl border border-[var(--border-zinc)] bg-white/50 p-6 shadow-sm dark:bg-zinc-900/30">
              <div class="mb-4 flex size-10 items-center justify-center rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]">
                <svg xmlns="http://www.w3.org/2000/svg" class="size-5 text-[var(--accent-gold)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              </div>
              <h5 class="text-sm font-bold text-[var(--text-primary)]">{{ t('บีบอัดและแชร์ไฟล์ (Zipped Files)') || 'บีบอัดและแชร์ไฟล์ (Zipped Files)' }}</h5>
              <p class="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                {{ t('แนบเอกสารราชการได้หลายไฟล์พร้อมกัน ระบบจะทำการรวมไฟล์และบีบอัดเป็น ZIP อัตโนมัติ เพื่อนำไปแชร์ผ่านรหัส QR เพียงโค้ดเดียว') || 'แนบเอกสารราชการได้หลายไฟล์พร้อมกัน ระบบจะทำการรวมไฟล์และบีบอัดเป็น ZIP อัตโนมัติ เพื่อนำไปแชร์ผ่านรหัส QR เพียงโค้ดเดียว' }}
              </p>
            </div>

            <!-- Card 3 -->
            <div class="rounded-xl border border-[var(--border-zinc)] bg-white/50 p-6 shadow-sm dark:bg-zinc-900/30">
              <div class="mb-4 flex size-10 items-center justify-center rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]">
                <svg xmlns="http://www.w3.org/2000/svg" class="size-5 text-[var(--accent-gold)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
              </div>
              <h5 class="text-sm font-bold text-[var(--text-primary)]">{{ t('ออกแบบสำหรับงานนำเสนอ (Official Custom)') || 'ออกแบบสำหรับงานนำเสนอ (Official Custom)' }}</h5>
              <p class="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                {{ t('ปรับแต่งรูปแบบจุด สีสัน ขอบมุม ใส่โลโก้ หรือข้อความประชาสัมพันธ์ใต้กรอบ เพื่อความน่าเชื่อถือ สุภาพ และเป็นระเบียบตามระเบียบสารบรรณ') || 'ปรับแต่งรูปแบบจุด สีสัน ขอบมุม ใส่โลโก้ หรือข้อความประชาสัมพันธ์ใต้กรอบ เพื่อความน่าเชื่อถือ สุภาพ และเป็นระเบียบตามระเบียบสารบรรณ' }}
              </p>
            </div>
          </div>
        </section>
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
