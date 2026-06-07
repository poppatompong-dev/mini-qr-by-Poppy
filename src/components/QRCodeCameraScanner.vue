<script setup lang="ts">
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode'
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const emit = defineEmits<{
  'qr-detected': [data: string]
  cancel: []
}>()

const { t } = useI18n()
const errorMessage = ref<string | null>(null)
const isLoading = ref(false)
const hasCamera = ref(false)
const scannerContainerId = 'html5-qrcode-scanner'
const html5QrCodeScanner = ref<Html5Qrcode | null>(null)
const isScanning = ref(false)
const CAMERA_PREFERENCE_KEY = 'qr-scanner-camera-preference'
const isFrontCamera = ref(localStorage.getItem(CAMERA_PREFERENCE_KEY) === 'front')
const hasMultipleCameras = ref(false)

const toggleCamera = () => {
  isFrontCamera.value = !isFrontCamera.value
  localStorage.setItem(CAMERA_PREFERENCE_KEY, isFrontCamera.value ? 'front' : 'back')
  startScanning()
}

const stopScanner = async () => {
  try {
    // Check if scanner is in scanning state before stopping
    if (html5QrCodeScanner.value?.getState() === Html5QrcodeScannerState.SCANNING) {
      await html5QrCodeScanner.value.stop()
    }
  } catch (err) {
    console.error('Error stopping QR scanner:', err)
  } finally {
    isScanning.value = false
  }
}

const stopScanning = async () => {
  await stopScanner()
  emit('cancel')
}

const startScanning = async () => {
  errorMessage.value = null
  isLoading.value = true

  // Stop scanning if already running
  await stopScanner()

  try {
    if (!html5QrCodeScanner.value) {
      html5QrCodeScanner.value = new Html5Qrcode(scannerContainerId)
    }

    const devices = await Html5Qrcode.getCameras()

    if (!devices || devices.length === 0) {
      errorMessage.value = t('No camera found on this device')
      isLoading.value = false
      return
    }

    hasMultipleCameras.value = devices && devices.length > 1

    // Select camera based on internal state and availability
    const preferredType = isFrontCamera.value ? 'front' : 'back'

    // Try to find the preferred camera type
    const preferredCamera = devices.find((device) => {
      const label = device.label.toLowerCase()
      if (preferredType === 'front') {
        return label.includes('front') || label.includes('user') || label.includes('selfie')
      } else {
        return label.includes('back') || label.includes('rear') || label.includes('environment')
      }
    })

    let cameraId = devices[0].id
    // If preferred camera type is found, use it
    if (preferredCamera) {
      cameraId = preferredCamera.id
    } else {
      // If preferred camera type isn't available, update the state to match what we're actually using
      const firstCameraLabel = devices[0].label.toLowerCase()
      const isFront =
        firstCameraLabel.includes('front') ||
        firstCameraLabel.includes('user') ||
        firstCameraLabel.includes('selfie')
      isFrontCamera.value = isFront
      localStorage.setItem(CAMERA_PREFERENCE_KEY, isFront ? 'front' : 'back')
    }

    await html5QrCodeScanner.value!.start(
      cameraId,
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false
      },
      (decodedText) => {
        emit('qr-detected', decodedText)
        stopScanning()
      },
      (_errorMessage) => {
        // QR code detection error (normal when no QR code is in view)
      }
    )

    isScanning.value = true
    isLoading.value = false
  } catch (err: any) {
    console.error('Error starting QR scanner:', err)

    if (err && err.name === 'NotAllowedError') {
      errorMessage.value = t(
        'Camera access denied. Please allow camera access in your browser settings.'
      )
    } else if (err && err.name === 'NotFoundError') {
      errorMessage.value = t('No camera found on this device')
    } else if (err && err.name === 'NotReadableError') {
      errorMessage.value = t('Camera is already in use by another application')
    } else {
      errorMessage.value = t('Could not start QR code scanner')
    }

    isLoading.value = false
  }
}

onUnmounted(() => {
  stopScanning()
})

onMounted(async () => {
  startScanning()
})

defineExpose({
  hasCamera,
  startScanning,
  stopScanning
})
</script>

<template>
  <div class="camera-scanner w-full">
    <div
      v-if="errorMessage"
      class="error-message mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-center text-xs font-semibold text-red-500"
    >
      {{ errorMessage }}
    </div>

    <!-- Scanner container -->
    <div
      class="scanner-container relative z-40 mx-auto mb-4 aspect-square max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-black shadow-lg dark:border-zinc-800"
    >
      <div :id="scannerContainerId" class="size-full"></div>

      <!-- Centered Viewfinder Target -->
      <div
        v-if="isScanning && !isLoading"
        class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
      >
        <div class="relative h-[260px] w-[260px] rounded-2xl border border-white/10 bg-black/15">
          <!-- Corner brackets -->
          <div
            class="absolute -left-1.5 -top-1.5 size-6 rounded-tl-lg border-l-[3px] border-t-[3px] border-[var(--accent-gold)]"
          ></div>
          <div
            class="absolute -right-1.5 -top-1.5 size-6 rounded-tr-lg border-r-[3px] border-t-[3px] border-[var(--accent-gold)]"
          ></div>
          <div
            class="absolute -bottom-1.5 -left-1.5 size-6 rounded-bl-lg border-b-[3px] border-l-[3px] border-[var(--accent-gold)]"
          ></div>
          <div
            class="absolute -bottom-1.5 -right-1.5 size-6 rounded-br-lg border-b-[3px] border-r-[3px] border-[var(--accent-gold)]"
          ></div>

          <!-- Scanning Laser line -->
          <div class="glowing-scanline"></div>
        </div>
      </div>

      <!-- Loading overlay -->
      <div
        v-if="isLoading"
        class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm"
      >
        <div
          class="size-10 animate-spin rounded-full border-4 border-solid border-zinc-700 border-t-[var(--accent-gold)]"
        ></div>
        <p class="mt-3 text-xs font-bold text-zinc-300">{{ t('Starting Camera...') }}</p>
      </div>

      <!-- Control buttons -->
      <div v-if="isScanning && !isLoading" class="absolute end-4 top-4 z-30 flex gap-2.5">
        <!-- Switch Camera button - only show if multiple cameras are available -->
        <button
          v-if="hasMultipleCameras"
          class="rounded-xl border border-white/10 bg-black/60 p-2 text-white shadow-md outline-none backdrop-blur-md transition-all hover:scale-105 hover:bg-black/80 active:scale-95"
          @click="toggleCamera"
          type="button"
          :aria-label="t('Switch camera')"
          :title="t('Switch camera')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M11 19c-1.9 0-3.7-.6-5.2-1.8L3 19v-6h6L6.8 15.2C7.9 16.3 9.4 17 11 17c3.3 0 6-2.7 6-6s-2.7-6-6-6c-1.9 0-3.6.9-4.7 2.3L4.9 5.9C6.4 4.2 8.6 3 11 3c4.4 0 8 3.6 8 8s-3.6 8-8 8Z"
            />
            <path d="M12 2v4" />
            <path d="M21 12h-4" />
          </svg>
        </button>

        <!-- Close button -->
        <button
          class="rounded-xl border border-white/10 bg-black/60 p-2 text-white shadow-md outline-none backdrop-blur-md transition-all hover:scale-105 hover:bg-black/80 active:scale-95"
          @click="stopScanning"
          :aria-label="t('Close scanner')"
          :title="t('Close scanner')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>

    <button
      v-if="isScanning && !isLoading"
      class="flex w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white py-2.5 text-xs font-bold text-zinc-600 outline-none transition-all hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
      @click="stopScanning"
    >
      {{ t('Cancel') }}
    </button>
  </div>
</template>

<style scoped>
.camera-scanner {
  width: 100%;
  position: relative;
}

.scanner-container {
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
  background-color: #000;
}

/* Override some of the html5-qrcode library styles */
:deep(video) {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover;
}

:deep(img) {
  max-width: 100%;
  border-radius: 12px;
}

.error-message {
  max-width: 100%;
}
</style>
