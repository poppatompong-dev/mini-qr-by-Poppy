<script setup lang="ts">
import {
  IS_PASTE_IMAGE_FROM_CLIPBOARD_SUPPORTED,
  KEY_COMBINATION_PASTE,
  getFileFromClipboardItems,
  getFileFromDataTransferItemList
} from '@/utils/clipboard'
import { Html5Qrcode } from 'html5-qrcode'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import QRCodeCameraScanner from './QRCodeCameraScanner.vue'

defineEmits<{
  'create-qr': [data: string]
}>()

const { t } = useI18n()

// #region Core QR Code Data
const capturedData = ref<string>('')
const errorMessage = ref<string | null>(null)
// #endregion Core QR Code Data

// #region QR Code Type Detection
const qrCodeType = computed(() => {
  const data = capturedData.value

  // URL detection (more comprehensive than just http)
  if (
    /^(https?:\/\/)?[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9](\.[a-zA-Z]{2,})+([/?#][^\s]*)?$/i.test(data)
  ) {
    return 'url'
  }

  // Email detection
  if (
    /^mailto:(.+)$/i.test(data) ||
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(data)
  ) {
    return 'email'
  }

  // Phone number detection
  if (/^tel:(.+)$/i.test(data) || /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/.test(data)) {
    return 'tel'
  }

  // SMS detection
  if (/^sms:(.+)$/i.test(data)) {
    return 'sms'
  }

  // WiFi detection
  if (/^WIFI:(.+)$/i.test(data)) {
    return 'wifi'
  }

  // vCard detection
  if (/^BEGIN:VCARD[\s\S]*END:VCARD$/i.test(data)) {
    return 'vcard'
  }

  // Calendar event detection
  if (/^BEGIN:VEVENT[\s\S]*END:VEVENT$/i.test(data)) {
    return 'calendar'
  }

  // Geo location detection
  if (/^geo:(.+)$/i.test(data)) {
    return 'geo'
  }

  // Default to text
  return 'text'
})

const formattedData = computed(() => {
  const data = capturedData.value
  const type = qrCodeType.value
  const hasProtocol = data.startsWith('http://') || data.startsWith('https://')

  switch (type) {
    case 'url':
      return hasProtocol ? data : `https://${data}`
    case 'email':
      return data.startsWith('mailto:') ? data : `mailto:${data}`
    case 'tel':
      return data.startsWith('tel:') ? data : `tel:${data}`
    case 'sms':
      return data.startsWith('sms:') ? data : `sms:${data}`
    case 'wifi':
      // Return as is for display purposes
      return data
    case 'vcard':
    case 'calendar':
    case 'geo':
      return data
    default:
      return data
  }
})

const isActionable = computed(() => {
  return ['url', 'email', 'tel', 'sms', 'geo'].includes(qrCodeType.value)
})
// #endregion QR Code Type Detection

// #region UI Display Properties
const qrCodeTypeIcon = computed(() => {
  switch (qrCodeType.value) {
    case 'url':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5m-6 8H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4zm-3-4h8v2H8z"/></svg>`
    case 'email':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2m0 4l-8 5l-8-5V6l8 5l8-5z"/></svg>`
    case 'tel':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24c1.12.37 2.33.57 3.57.57c.55 0 1 .45 1 1V20c0 .55-.45 1-1 1c-9.39 0-17-7.61-17-17c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1c0 1.25.2 2.45.57 3.57c.11.35.03.74-.25 1.02z"/></svg>`
    case 'sms':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2M9 11H7V9h2zm4 0h-2V9h2zm4 0h-2V9h2z"/></svg>`
    case 'wifi':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9m8 8l3 3l3-3a4.237 4.237 0 0 0-6 0m-4-4l2 2a7.074 7.074 0 0 1 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>`
    case 'vcard':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2m-7 2h2.5v12H13zm-2 12H8.5V6H11zM4 6h2.5v12H4zm16 12h-2.5V6H20z"/></svg>`
    case 'calendar':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m0 16H5V8h14zm-7-5h5v5h-5z"/></svg>`
    case 'geo':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7m0 9.5a2.5 2.5 0 0 1 0-5a2.5 2.5 0 0 1 0 5z"/></svg>`
    default:
      return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83l3.75 3.75l1.83-1.83a.996.996 0 0 0 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29m-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/></svg>`
  }
})

const typeLabel = computed(() => {
  switch (qrCodeType.value) {
    case 'url':
      return t('URL')
    case 'email':
      return t('Email')
    case 'tel':
      return t('Phone Number')
    case 'sms':
      return t('SMS')
    case 'wifi':
      return t('WiFi')
    case 'vcard':
      return t('Contact Card')
    case 'calendar':
      return t('Calendar Event')
    case 'geo':
      return t('Location')
    default:
      return t('Text')
  }
})

// #endregion UI Display Properties

// #region User Actions
const copySuccess = ref(false)
const showCameraScanner = ref(false)

const copyToClipboard = async () => {
  if (!capturedData.value) return

  try {
    await navigator.clipboard.writeText(capturedData.value)
    copySuccess.value = true

    // Clear the success message after 3 seconds
    setTimeout(() => {
      copySuccess.value = false
    }, 3000)
  } catch (err) {
    errorMessage.value = t('Failed to copy to clipboard')
    console.error(err)
  }
}

/**
 * Handle both an event of paste from clipboard and a button press 'Paste from clipboard'
 * @param event : ClipboardEvent | null
 */
const pasteFromClipboard = async (event: ClipboardEvent | null) => {
  try {
    let file: File | null = null

    if (event && event.clipboardData && event.clipboardData.items) {
      // user action Ctrl+V
      file = await getFileFromDataTransferItemList(event.clipboardData.items)
    } else {
      // button press
      file = await getFileFromClipboardItems(await navigator.clipboard.read())
    }

    if (file == null) {
      errorMessage.value = t('No image found in clipboard.')
      return
    }

    scanFile(file)
  } catch (err: any) {
    console.error('Clipboard paste failed', err)
  }
}

onMounted(() => {
  window.addEventListener('paste', pasteFromClipboard)
})

const onQRDetected = (data: string) => {
  capturedData.value = data
  showCameraScanner.value = false
}

const onCameraScannerCancel = () => {
  showCameraScanner.value = false
}

const startCameraScanning = () => {
  errorMessage.value = null
  showCameraScanner.value = true
}

const resetCapture = () => {
  capturedData.value = ''
  errorMessage.value = null
  copySuccess.value = false
  showCameraScanner.value = false
}
// #endregion User Actions

// #region File Handling
const fileInput = ref<HTMLInputElement | null>(null)
const isLoading = ref(false)
const isDraggingOver = ref(false)

const catchScanFileError = async (err: Error, file: File) => {
  console.warn('Html5Qrcode failed, will try fallback to nimiq/qr-scanner:', err)

  const QrScanner = (await import('qr-scanner')).default

  // Fallback to nimiq/qr-scanner lib
  try {
    const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true })
    capturedData.value = result.data
  } catch (err) {
    console.error('Fallback to nimiq/qr-scanner failed:', err)
    errorMessage.value = t('No QR code found in the image.')
  } finally {
    isLoading.value = false
  }
}

const scanFile = (file: File) => {
  isLoading.value = true
  errorMessage.value = null

  const html5QrCode = new Html5Qrcode('file-qr-reader')
  html5QrCode
    .scanFile(file, false)
    .then((decodedText) => {
      capturedData.value = decodedText
      isLoading.value = false
    })
    .catch((err) => catchScanFileError(err, file))
}

const handleFileUpload = (event: Event) => {
  let file: File | null = null

  // Handle drag and drop event
  if (event.type === 'drop') {
    const dt = (event as DragEvent).dataTransfer
    if (dt?.files && dt.files.length > 0) {
      file = dt.files[0]
    }
  }
  // Handle file input change event
  else {
    const target = event.target as HTMLInputElement
    if (target.files && target.files.length > 0) {
      file = target.files[0]
    }
  }

  if (!file) return

  scanFile(file)
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  isDraggingOver.value = true
}

const handleDragLeave = () => {
  isDraggingOver.value = false
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  isDraggingOver.value = false
  handleFileUpload(event)
}
// #endregion File Handling

defineExpose({
  capturedData,
  isLoading,
  resetCapture,
  copyToClipboard
})
</script>

<template>
  <div class="relative mx-auto w-full max-w-xl">
    <!-- Decoded Results Card -->
    <div v-if="capturedData" class="scan-results-entrance glass-card border border-zinc-200 bg-white p-6 text-center shadow-lg dark:border-zinc-800 dark:bg-zinc-900/40 sm:p-8">
      <div class="mb-6 flex flex-col items-center justify-center">
        <div class="mb-3 flex size-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
          <span v-html="qrCodeTypeIcon" class="inline-block size-6"></span>
        </div>
        <h3 class="mb-1.5 text-base font-bold text-zinc-800 dark:text-zinc-100">{{ t('QR Code Content') }}</h3>
        <span class="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {{ typeLabel }}
        </span>
      </div>

      <!-- Result content card -->
      <div class="mx-auto mb-6 max-w-md rounded-2xl border border-zinc-100 bg-zinc-50/50 p-4 text-left dark:border-zinc-800/80 dark:bg-zinc-950/20">
        <span class="mb-2 block text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">ข้อมูลสแกน (Decoded Data)</span>
        <div class="no-scrollbar max-h-48 overflow-auto">
          <component
            :is="isActionable ? 'a' : 'p'"
            :href="isActionable ? formattedData : undefined"
            :target="qrCodeType === 'url' ? '_blank' : undefined"
            class="block break-all font-mono text-xs text-zinc-700 no-underline hover:underline dark:text-zinc-300"
            :class="isActionable ? 'text-blue-600 dark:text-blue-400 font-semibold cursor-pointer' : ''"
          >
            {{ capturedData }}
          </component>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="mx-auto flex max-w-md flex-col gap-2.5">
        <div class="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            class="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-semibold text-zinc-700 outline-none transition-all hover:scale-[1.02] hover:bg-zinc-100 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            @click="copyToClipboard"
          >
            <svg v-if="!copySuccess" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>{{ copySuccess ? t('Copied!') : t('Copy to clipboard') }}</span>
          </button>

          <button
            type="button"
            class="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/10 outline-none transition-all hover:scale-[1.02] hover:bg-blue-700 active:scale-[0.98]"
            @click="$emit('create-qr', capturedData)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            <span>{{ t('Create QR Code with this data') }}</span>
          </button>
        </div>

        <button
          type="button"
          class="flex w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white py-2.5 text-xs font-bold text-zinc-600 outline-none transition-all hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
          @click="resetCapture"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          <span>{{ t('Scan Another') }}</span>
        </button>
      </div>
    </div>

    <!-- Active Camera Viewport Card -->
    <div v-else-if="showCameraScanner" class="glass-card w-full border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-zinc-900/40">
      <QRCodeCameraScanner @qr-detected="onQRDetected" @cancel="onCameraScannerCancel" />
    </div>

    <!-- Dropzone Scan Controls Card -->
    <div v-else class="glass-card border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-900/40 sm:p-8">
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-10">
        <div class="dark:border-zinc-850 mb-4 size-10 animate-spin rounded-full border-4 border-solid border-zinc-200 border-t-blue-500"></div>
        <p class="text-xs font-bold text-zinc-500 dark:text-zinc-400">{{ t('Processing...') }}</p>
      </div>

      <!-- Hidden reader container for Html5Qrcode -->
      <div id="file-qr-reader" class="hidden"></div>

      <div class="flex flex-col gap-6" v-if="!isLoading">
        <div class="text-center">
          <h3 class="mb-4 text-sm font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-100">{{ t('Scan a QR Code') }}</h3>

          <!-- Drag Dropzone -->
          <div
            :class="[
              'upload-dropzone-pulse duration-350 cursor-pointer rounded-2xl border-2 border-dashed p-6 py-10 text-center outline-none transition-all',
              isDraggingOver
                ? 'scale-[1.01] border-[var(--accent-blue)] bg-blue-500/5 dark:bg-blue-950/10'
                : 'hover:border-zinc-350 border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/10 dark:hover:border-zinc-700'
            ]"
            :style="{ transitionTimingFunction: 'var(--ease-out-expo)' }"
            @click="fileInput?.click()"
            @keyup.enter="fileInput?.click()"
            @keyup.space="fileInput?.click()"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleDrop"
          >
            <div class="flex flex-col items-center gap-2.5">
              <div class="flex size-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400 transition-transform duration-300 hover:-translate-y-0.5 dark:bg-zinc-800 dark:text-zinc-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </div>
              <p class="text-xs font-bold text-zinc-700 dark:text-zinc-300">{{ t('Upload QR Code Image') }}</p>
              <p class="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">{{ t('or drag and drop an image here') }}</p>
            </div>
          </div>
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            class="hidden"
            @change="handleFileUpload"
          />

          <!-- Error Alert -->
          <p v-if="errorMessage" class="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500">
            {{ errorMessage }}
          </p>

          <!-- Tip -->
          <p class="mt-3 text-[10px] text-zinc-400 dark:text-zinc-500">
            {{ t('Tip: For best results, use a clear image with good lighting.') }}
          </p>

          <!-- Divider line -->
          <div class="my-6 flex items-center justify-center gap-3">
            <div class="h-px flex-1 bg-zinc-100 dark:bg-zinc-800"></div>
            <span class="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{{ t('or') }}</span>
            <div class="h-px flex-1 bg-zinc-100 dark:bg-zinc-800"></div>
          </div>

          <!-- Quick Action Buttons -->
          <div class="mx-auto flex max-w-sm items-center justify-center gap-2">
            <!-- Camera Scanner -->
            <button
              class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/10 outline-none transition-all hover:scale-[1.02] hover:bg-blue-700 active:scale-[0.98]"
              @click="startCameraScanning"
              type="button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              {{ t('Scan with Camera') }}
            </button>

            <!-- Paste Clipboard Option -->
            <button
              v-if="IS_PASTE_IMAGE_FROM_CLIPBOARD_SUPPORTED"
              class="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-semibold text-zinc-700 outline-none transition-all hover:scale-[1.02] hover:bg-zinc-100 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              @click="pasteFromClipboard(null)"
              type="button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              {{ t('Paste') }}
              <span class="rounded bg-zinc-200/50 px-1 py-0.5 font-mono text-[9px] opacity-60 dark:bg-zinc-800" v-html="KEY_COMBINATION_PASTE"></span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
