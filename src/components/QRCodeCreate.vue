<script setup lang="ts">
import BatchExportFieldsGuide from '@/components/BatchExportFieldsGuide.vue'
import CopyImageModal from '@/components/CopyImageModal.vue'
import InlineDataTemplates from '@/components/InlineDataTemplates.vue'
import QRCodeFrame from '@/components/QRCodeFrame.vue'
import StyledQRCode from '@/components/StyledQRCode.vue'
import { Combobox } from '@/components/ui/Combobox'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger
} from '@/components/ui/drawer'
import { IS_COPY_IMAGE_TO_CLIPBOARD_SUPPORTED } from '@/utils/clipboard'
import { createRandomColor, getRandomItemInArray } from '@/utils/color'
import {
  copyImageToClipboard,
  downloadJpgElement,
  downloadPngElement,
  downloadSvgElement,
  getInlinedSvgString,
  getJpgElement,
  getPngElement
} from '@/utils/convertToImage'
import { downloadBlob } from '@/utils/download'
import { parseCSV, validateCSVData, type CSVParsingResult } from '@/utils/csv'
import { generateBatchExportFilename, processCsvDataForBatch } from '@/utils/csvBatchProcessing'
import { getNumericCSSValue } from '@/utils/formatting'
import FitScaleBox from '@/components/FitScaleBox.vue'
import {
  allFramePresets,
  defaultFramePreset,
  FONT_OPTIONS,
  loadGoogleFont,
  type FontCategory,
  type FontOption,
  type FramePreset,
  type FrameStyle
} from '@/utils/framePresets'
import {
  allQrCodePresets,
  defaultPreset,
  isValidQRCodeConfig,
  type Preset
} from '@/utils/qrCodePresets'
import {
  CUSTOM_LOADED_PRESET_KEYS,
  hasStoredQRConfig,
  isLocalStorageEnabled,
  LAST_LOADED_LOCALLY_PRESET_KEY,
  LOADED_FROM_FILE_PRESET_KEY,
  loadQRConfig,
  saveQRConfig,
  serializeQRConfig,
  type QRCodeConfig,
  type QRCodeFrameConfig
} from '@/utils/useQRCodeStorage'
import { useMediaQuery } from '@vueuse/core'
import {
  UploadCloud,
  Globe,
  Type,
  Wifi,
  FileArchive,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  MessageSquare,
  Info
} from 'lucide-vue-next'
import JSZip from 'jszip'
import TextExportModal from '@/components/TextExportModal.vue'
import {
  buildMatrix,
  type CornerDotType,
  type CornerSquareType,
  type DotType,
  type ErrorCorrectionLevel,
  type Options as StyledQRCodeProps
} from '@/lib/qr-code'
import { computed, onMounted, ref, watch } from 'vue'
import 'vue-i18n'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  initialData?: string
  showUserGuide?: boolean
}>()

const mainContentContainer = ref<HTMLElement | null>(null)
const isLarge = useMediaQuery('(min-width: 768px)')
const isLikelyMobileDevice = computed(() => {
  return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0
})

//#region /** locale */
const { t, locale } = useI18n()
const isAutomation = typeof navigator !== 'undefined' && navigator.webdriver
//#endregion

//#region /* QR code style settings */
const data = ref(props.initialData || import.meta.env.VITE_DEFAULT_DATA_TO_ENCODE || '')
const debouncedData = ref(data.value)
const previewData = computed(() =>
  debouncedData.value?.length > 0 ? debouncedData.value : defaultQRCodeText.value
)
let dataDebounceTimer: ReturnType<typeof setTimeout>

watch(
  data,
  (newVal) => {
    clearTimeout(dataDebounceTimer)
    dataDebounceTimer = setTimeout(() => {
      debouncedData.value = newVal
    }, 500)
  },
  { immediate: true }
)
const image = ref()
const width = ref()
const height = ref()
const margin = ref(12)
const imageMargin = ref()
const imageSize = ref<number | undefined>()

watch(
  () => props.initialData,
  (newValue) => {
    if (newValue) {
      data.value = newValue
    }
  }
)

const dotsOptionsColor = ref()
const dotsOptionsType = ref()
const cornersSquareOptionsColor = ref()
const cornersSquareOptionsType = ref()
const cornersDotOptionsColor = ref()
const cornersDotOptionsType = ref()
const styleBorderRadius = ref()
const styledBorderRadiusFormatted = computed(() => `${styleBorderRadius.value}px`)
const exportBorderRadius = computed(() =>
  showFrame.value ? frameStyle.value.borderRadius : styledBorderRadiusFormatted.value
)
const styleBackground = ref(defaultPreset.style.background)
const lastBackground = ref(defaultPreset.style.background)
const includeBackground = ref(true)
watch(
  includeBackground,
  (newIncludeBackground) => {
    if (!newIncludeBackground) {
      lastBackground.value = styleBackground.value
      styleBackground.value = 'transparent'
    } else {
      styleBackground.value = lastBackground.value
    }
  },
  {
    immediate: true
  }
)

const dotsOptions = computed(() => ({
  color: dotsOptionsColor.value,
  type: dotsOptionsType.value
}))
const cornersSquareOptions = computed(() => ({
  color: cornersSquareOptionsColor.value,
  type: cornersSquareOptionsType.value
}))
const cornersDotOptions = computed(() => ({
  color: cornersDotOptionsColor.value,
  type: cornersDotOptionsType.value
}))
const style = computed(() => ({
  borderRadius: styledBorderRadiusFormatted.value,
  background: styleBackground.value
}))
const imageOptions = computed(() => ({
  margin: imageMargin.value,
  imageSize: imageSize.value
}))

const qrOptions = computed(() => ({
  errorCorrectionLevel: errorCorrectionLevel.value
}))

const qrCodeProps = computed<StyledQRCodeProps>(() => ({
  data: previewData.value,
  image: image.value,
  width: width.value,
  height: height.value,
  margin: margin.value,
  dotsOptions: dotsOptions.value,
  cornersSquareOptions: cornersSquareOptions.value,
  cornersDotOptions: cornersDotOptions.value,
  imageOptions: imageOptions.value,
  qrOptions: qrOptions.value
}))

function randomizeStyleSettings() {
  const dotTypes: DotType[] = [
    'dots',
    'rounded',
    'classy',
    'classy-rounded',
    'square',
    'extra-rounded'
  ]
  const cornerSquareTypes: CornerSquareType[] = ['dot', 'square', 'rounded', 'extra-rounded']
  const cornerDotTypes: CornerDotType[] = ['dot', 'square', 'rounded']

  dotsOptionsType.value = getRandomItemInArray(dotTypes)
  dotsOptionsColor.value = createRandomColor()

  cornersSquareOptionsType.value = getRandomItemInArray(cornerSquareTypes)
  cornersSquareOptionsColor.value = createRandomColor()

  cornersDotOptionsType.value = getRandomItemInArray(cornerDotTypes)
  cornersDotOptionsColor.value = createRandomColor()

  styleBackground.value = createRandomColor()
}

function uploadImage() {
  console.debug('Uploading image')
  const imageInput = document.createElement('input')
  imageInput.type = 'file'
  imageInput.accept = 'image/*'
  imageInput.onchange = (event: Event) => {
    const target = event.target as HTMLInputElement
    if (target.files) {
      const file = target.files[0]
      const reader = new FileReader()
      reader.onload = (event: ProgressEvent<FileReader>) => {
        const target = event.target as FileReader
        const result = target.result as string
        image.value = result
      }
      reader.readAsDataURL(file)
    }
  }
  imageInput.click()
}
// #endregion

// #region /* Preset settings */
const isPresetSelectOpen = ref(false)
const allPresetOptions = computed(() => {
  const options = lastCustomLoadedPreset.value
    ? [lastCustomLoadedPreset.value, ...allQrCodePresets]
    : allQrCodePresets
  return options.map((preset) => ({ value: preset.name, label: t(preset.name) }))
})
const selectedPreset = ref<
  Preset & { key?: string; qrOptions?: { errorCorrectionLevel: ErrorCorrectionLevel } }
>(defaultPreset)

const selectedPresetKey = ref<string>(
  isLocalStorageEnabled() && hasStoredQRConfig()
    ? LAST_LOADED_LOCALLY_PRESET_KEY
    : defaultPreset.name
)
const lastCustomLoadedPreset = ref<Preset>()
watch(
  selectedPresetKey,
  (newKey, prevKey) => {
    if (newKey === prevKey || !newKey) return

    if (
      import.meta.env.VITE_DISABLE_LOCAL_STORAGE !== 'true' &&
      CUSTOM_LOADED_PRESET_KEYS.includes(newKey) &&
      lastCustomLoadedPreset.value
    ) {
      selectedPreset.value = lastCustomLoadedPreset.value
      return
    }

    const updatedPreset = allQrCodePresets.find((preset) => preset.name === newKey)
    if (updatedPreset) {
      selectedPreset.value = updatedPreset
    }
  },
  { immediate: true }
)
//#endregion

//#region /* Error correction level */
const errorCorrectionLevels: ErrorCorrectionLevel[] = ['L', 'M', 'Q', 'H']
const errorCorrectionLevel = ref<ErrorCorrectionLevel>('H')
const ERROR_CORRECTION_LEVEL_LABELS: Record<ErrorCorrectionLevel, string> = {
  L: `Low (7%)`,
  M: `Medium (15%)`,
  Q: `High (25%)`,
  H: `Highest (30%)`
}
const recommendedErrorCorrectionLevel = computed<ErrorCorrectionLevel | null>(() => {
  if (!data.value) return null
  if (data.value.length <= 50) {
    return 'H'
  } else if (data.value.length <= 150) {
    return 'Q'
  } else if (data.value.length <= 500) {
    return 'M'
  } else {
    return 'L'
  }
})
//#endregion

//#region /* Frame settings */ Start empty, default is set intelligently */
const defaultFrameText = computed(() => t('Scan for more info'))
const frameText = ref<string>('')
const frameTextPosition = ref<'top' | 'bottom' | 'left' | 'right'>('bottom')
const frameTextTop = ref<string>('')
const frameTextBottom = ref<string>('')
const frameTextTopSize = ref<number>(18)
const frameTextBottomSize = ref<number>(18)
const frameTextTopColor = ref<string>('')
const frameTextBottomColor = ref<string>('')
const frameTextTopWeight = ref<string>('normal')
const frameTextBottomWeight = ref<string>('normal')
const frameTextTopItalic = ref<string>('normal')
const frameTextBottomItalic = ref<string>('normal')
const frameTextTopFont = ref<string>('')
const frameTextBottomFont = ref<string>('')
// Side captions only: the user sets the overall "Frame width"; the caption
// column derives from it via the simplified relation
//   caption width = frame width − QR width (200 preview px).
// Invalid input (out of range / empty) shows an error and leaves the last
// valid caption width applied.
const FRAME_WIDTH_MIN = 250
const FRAME_WIDTH_MAX = 800
const frameWidth = ref(400)
const isFrameWidthValid = computed(
  () =>
    typeof frameWidth.value === 'number' &&
    Number.isFinite(frameWidth.value) &&
    frameWidth.value >= FRAME_WIDTH_MIN &&
    frameWidth.value <= FRAME_WIDTH_MAX
)
const frameCaptionWidth = ref(200)
watch(frameWidth, () => {
  if (isFrameWidthValid.value) {
    frameCaptionWidth.value = frameWidth.value - PREVIEW_QRCODE_DIM_UNIT
  }
})
const showFrame = ref(false)

// Cap the framed preview's layout footprint (via FitScaleBox) so wide side
// captions can't grow the (content-sized) preview column, push the settings
// aside, or overflow the viewport on mobile. #element-to-export keeps its
// natural size, so export measurements (getExportDimensions) are unaffected.
const FRAME_PREVIEW_MAX_WIDTH = 450

const frameStyle = ref<FrameStyle>({
  textColor: '#000000',
  backgroundColor: '#ffffff',
  borderColor: '#000000',
  borderWidth: '1px',
  borderRadius: '8px',
  padding: '16px'
})

const selectedFramePresetKey = ref<string>(
  import.meta.env.VITE_FRAME_PRESET || defaultFramePreset.name
)

function toFrameStyle(style: Partial<FrameStyle>): FrameStyle {
  return {
    textColor: style.textColor ?? '#000000',
    backgroundColor: style.backgroundColor ?? '#ffffff',
    borderColor: style.borderColor ?? '#000000',
    borderWidth: style.borderWidth ?? '1px',
    borderRadius: style.borderRadius ?? '8px',
    padding: style.padding ?? '16px',
    ...(style.fontFamily ? { fontFamily: style.fontFamily } : {}),
    ...(style.backgroundImage ? { backgroundImage: style.backgroundImage } : {})
  }
}

function uploadFrameBackgroundImage() {
  const imageInput = document.createElement('input')
  imageInput.type = 'file'
  imageInput.accept = 'image/*'
  imageInput.onchange = (event: Event) => {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      frameStyle.value = { ...frameStyle.value, backgroundImage: reader.result as string }
    }
    reader.readAsDataURL(file)
  }
  imageInput.click()
}

function removeFrameBackgroundImage() {
  const { backgroundImage: _omitted, ...rest } = frameStyle.value
  frameStyle.value = rest
}

// One "Background" setting switching between a color and an image. Picking
// Color clears any uploaded image; the image mode persists implicitly via
// frameStyle.backgroundImage, so restored configs and presets drive the
// radio through the second watcher.
const frameBackgroundType = ref<'color' | 'image'>('color')
watch(frameBackgroundType, (type) => {
  if (type === 'color') removeFrameBackgroundImage()
})
watch(
  () => frameStyle.value.backgroundImage,
  (backgroundImage) => {
    frameBackgroundType.value = backgroundImage ? 'image' : 'color'
  },
  { immediate: true }
)

function loadFrameFont(fontFamily?: string) {
  if (!fontFamily) return
  const font = FONT_OPTIONS.find((f) => f.value === fontFamily)
  if (font?.googleFontName) {
    loadGoogleFont(font.googleFontName)
  }
}

function applyFrameFromPreset(frame?: QRCodeFrameConfig) {
  if (!frame) return
  showFrame.value = true
  frameText.value = frame.text || defaultFrameText.value
  frameTextPosition.value = frame.position || 'bottom'
  frameStyle.value = toFrameStyle(frame.style)
  loadFrameFont(frame.style?.fontFamily)
  frameTextTop.value = frame.textTop || ''
  frameTextBottom.value = frame.textBottom || ''
  frameTextTopSize.value = frame.fontSizeTop ?? 18
  frameTextBottomSize.value = frame.fontSizeBottom ?? 18
  frameTextTopColor.value = frame.textColorTop || ''
  frameTextBottomColor.value = frame.textColorBottom || ''
  frameTextTopWeight.value = frame.fontWeightTop || 'normal'
  frameTextBottomWeight.value = frame.fontWeightBottom || 'normal'
  frameTextTopItalic.value = frame.fontStyleTop || 'normal'
  frameTextBottomItalic.value = frame.fontStyleBottom || 'normal'
  frameTextTopFont.value = frame.fontFamilyTop || ''
  frameTextBottomFont.value = frame.fontFamilyBottom || ''
  if (frame.fontFamilyTop) loadFrameFont(frame.fontFamilyTop)
  if (frame.fontFamilyBottom) loadFrameFont(frame.fontFamilyBottom)
}

function applySelectedPresetToState() {
  const preset = selectedPreset.value
  // Note: We no longer auto-fill data from presets. Users can keep their own data
  // while changing the visual style. The QR preview will show default text if empty.

  image.value = preset.image
  width.value = preset.width
  height.value = preset.height
  margin.value = preset.margin
  imageMargin.value = preset.imageOptions.margin
  imageSize.value = preset.imageOptions.imageSize
  dotsOptionsColor.value = preset.dotsOptions.color
  dotsOptionsType.value = preset.dotsOptions.type
  cornersSquareOptionsColor.value = preset.cornersSquareOptions.color
  cornersSquareOptionsType.value = preset.cornersSquareOptions.type
  cornersDotOptionsColor.value = preset.cornersDotOptions.color
  cornersDotOptionsType.value = preset.cornersDotOptions.type
  styleBorderRadius.value = getNumericCSSValue(preset.style.borderRadius as string)
  styleBackground.value = preset.style.background
  includeBackground.value = preset.style.background !== 'transparent'
  errorCorrectionLevel.value = preset.qrOptions?.errorCorrectionLevel
    ? preset.qrOptions.errorCorrectionLevel
    : 'Q'
  const frame = (preset as Preset & { frame?: QRCodeFrameConfig }).frame
  if (frame) {
    applyFrameFromPreset(frame)
    const framePresetName = import.meta.env.VITE_FRAME_PRESET || preset.name
    if (allFramePresets.some((p) => p.name === framePresetName)) {
      selectedFramePresetKey.value = framePresetName
    }
  } else {
    showFrame.value = false
  }
}

watch(selectedPreset, applySelectedPresetToState, { immediate: true })

//#region /* Default QR code text */
const defaultQRCodeText = computed(() => t('Have nice day!'))
const lastCustomLoadedFramePreset = ref<FramePreset>()
const CUSTOM_LOADED_FRAME_PRESET_KEYS = [
  LAST_LOADED_LOCALLY_PRESET_KEY,
  LOADED_FROM_FILE_PRESET_KEY
]

const allFramePresetOptions = computed(() => {
  const options = lastCustomLoadedFramePreset.value
    ? [lastCustomLoadedFramePreset.value, ...allFramePresets]
    : allFramePresets
  return options.map((preset) => ({ value: preset.name, label: t(preset.name) }))
})

function applyFramePreset(preset: FramePreset, enableFrame = true) {
  if (preset.style) {
    frameStyle.value = toFrameStyle(preset.style)
    loadFrameFont(preset.style.fontFamily)
  }
  const anyPreset = preset as any
  if (anyPreset.textTop !== undefined) {
    frameTextTop.value = anyPreset.textTop || ''
  }
  if (anyPreset.textBottom !== undefined) {
    frameTextBottom.value = anyPreset.textBottom || ''
  }
  if (anyPreset.fontSizeTop !== undefined) frameTextTopSize.value = anyPreset.fontSizeTop
  if (anyPreset.fontSizeBottom !== undefined) frameTextBottomSize.value = anyPreset.fontSizeBottom
  if (anyPreset.textColorTop !== undefined) frameTextTopColor.value = anyPreset.textColorTop || ''
  if (anyPreset.textColorBottom !== undefined) frameTextBottomColor.value = anyPreset.textColorBottom || ''
  if (anyPreset.fontWeightTop !== undefined) frameTextTopWeight.value = anyPreset.fontWeightTop || 'normal'
  if (anyPreset.fontWeightBottom !== undefined) frameTextBottomWeight.value = anyPreset.fontWeightBottom || 'normal'
  if (anyPreset.fontStyleTop !== undefined) frameTextTopItalic.value = anyPreset.fontStyleTop || 'normal'
  if (anyPreset.fontStyleBottom !== undefined) frameTextBottomItalic.value = anyPreset.fontStyleBottom || 'normal'
  if (anyPreset.fontFamilyTop !== undefined) {
    frameTextTopFont.value = anyPreset.fontFamilyTop || ''
    if (frameTextTopFont.value) loadFrameFont(frameTextTopFont.value)
  }
  if (anyPreset.fontFamilyBottom !== undefined) {
    frameTextBottomFont.value = anyPreset.fontFamilyBottom || ''
    if (frameTextBottomFont.value) loadFrameFont(frameTextBottomFont.value)
  }

  if (preset.text) frameText.value = preset.text
  if (preset.position) frameTextPosition.value = preset.position

  if (!frameTextTop.value && !frameTextBottom.value && preset.text) {
    if (preset.position === 'top') {
      frameTextTop.value = preset.text
    } else {
      frameTextBottom.value = preset.text
    }
  }
  if (enableFrame) {
    showFrame.value = true
  }
}

watch(selectedFramePresetKey, (newKey, prevKey) => {
  if (newKey === prevKey || !newKey) return

  if (
    import.meta.env.VITE_DISABLE_LOCAL_STORAGE !== 'true' &&
    CUSTOM_LOADED_FRAME_PRESET_KEYS.includes(newKey) &&
    lastCustomLoadedFramePreset.value
  ) {
    applyFramePreset(lastCustomLoadedFramePreset.value)
    return
  }

  const preset = allFramePresets.find((p) => p.name === newKey)
  if (preset) {
    applyFramePreset(preset)
  }
})

const frameSettings = computed(() => ({
  text: frameText.value,
  position: frameTextPosition.value,
  style: frameStyle.value,
  captionWidth: frameCaptionWidth.value,
  textTop: frameTextTop.value,
  textBottom: frameTextBottom.value,
  textColorTop: frameTextTopColor.value,
  textColorBottom: frameTextBottomColor.value,
  fontSizeTop: frameTextTopSize.value,
  fontSizeBottom: frameTextBottomSize.value,
  fontWeightTop: frameTextTopWeight.value,
  fontWeightBottom: frameTextBottomWeight.value,
  fontStyleTop: frameTextTopItalic.value,
  fontStyleBottom: frameTextBottomItalic.value,
  fontFamilyTop: frameTextTopFont.value,
  fontFamilyBottom: frameTextBottomFont.value
}))

const FONT_CATEGORY_LABELS: Record<FontCategory, string> = {
  sans: 'Sans-serif',
  serif: 'Serif',
  monospace: 'Monospace',
  display: 'Display & Cursive'
}

const groupedFontOptions = computed(() => {
  const ungrouped: FontOption[] = []
  const groups = new Map<FontCategory, FontOption[]>()
  for (const font of FONT_OPTIONS) {
    if (!font.category) {
      ungrouped.push(font)
      continue
    }
    const list = groups.get(font.category) ?? []
    list.push(font)
    groups.set(font.category, list)
  }
  const orderedCategories: FontCategory[] = ['sans', 'serif', 'monospace', 'display']
  return {
    ungrouped,
    groups: orderedCategories
      .filter((c) => groups.has(c))
      .map((c) => ({ category: c, label: FONT_CATEGORY_LABELS[c], fonts: groups.get(c)! }))
  }
})

function onFontFamilyChange(value: string): Promise<void> {
  // value may be a label name (e.g. "Poppins" from CSV) or a full CSS value (e.g. "'Poppins', sans-serif" from UI)
  const font = FONT_OPTIONS.find((f) => f.value === value || f.label === value)
  const resolvedValue = font ? font.value : value
  frameStyle.value = { ...frameStyle.value, fontFamily: resolvedValue || undefined }
  if (font?.googleFontName) {
    return loadGoogleFont(font.googleFontName)
  }
  return Promise.resolve()
}

function onFontFamilyTopChange(value: string): Promise<void> {
  const font = FONT_OPTIONS.find((f) => f.value === value || f.label === value)
  const resolvedValue = font ? font.value : value
  frameTextTopFont.value = resolvedValue || ''
  if (font?.googleFontName) {
    return loadGoogleFont(font.googleFontName)
  }
  return Promise.resolve()
}

function onFontFamilyBottomChange(value: string): Promise<void> {
  const font = FONT_OPTIONS.find((f) => f.value === value || f.label === value)
  const resolvedValue = font ? font.value : value
  frameTextBottomFont.value = resolvedValue || ''
  if (font?.googleFontName) {
    return loadGoogleFont(font.googleFontName)
  }
  return Promise.resolve()
}
//#endregion

//#region /* Frame text autofill */ Fill if empty */
watch(locale, () => {
  if (frameText.value.trim() === '') {
    frameText.value = defaultFrameText.value
  }
})

watch(defaultFrameText, (now, prev) => {
  const untouched = frameText.value.trim() === '' || frameText.value === prev
  if (untouched) {
    frameText.value = now
  }
})

watch(showFrame, (on) => {
  if (on && frameText.value.trim() === '') {
    frameText.value = defaultFrameText.value
  }
})

onMounted(() => {
  if (frameText.value.trim() === '') {
    frameText.value = defaultFrameText.value
  }
})
//#endregion

//#region /* QR code text autofill -  Fill if empty */
watch(locale, () => {
  if (!props.initialData && data.value.trim() === '') {
    data.value = defaultQRCodeText.value
  }
})

watch(defaultQRCodeText, (now, prev) => {
  const untouched = !props.initialData && (data.value.trim() === '' || data.value === prev)
  if (untouched) {
    data.value = now
  }
})

//#endregion

//#region /* General Export - download qr code and copy to clipboard */
const isExportButtonDisabled = computed(() => {
  if (exportMode.value === ExportMode.Single) {
    return !data.value
  }
  return dataStringsFromCsv.value.length === 0
})

const PREVIEW_QRCODE_DIM_UNIT = 200

/**
 * Calculates the dimensions for QR code export
 * When frame is enabled (showFrame = true), dimensions are calculated from the actual rendered element
 * to include the frame's size. Otherwise, uses the configured width and height values.
 */
function getExportDimensions() {
  if (!showFrame.value) {
    return {
      width: width.value,
      height: height.value
    }
  }
  const el = document.getElementById('element-to-export')
  if (!el) {
    return {
      width: width.value,
      height: height.value
    }
  }

  // Calculate the scale factor based on the preview size
  const scaleFactor = width.value / PREVIEW_QRCODE_DIM_UNIT

  const elWidth = el.offsetWidth
  const elHeight = el.offsetHeight

  // Get the actual dimensions including the frame and apply the scale factor
  return {
    width: elWidth * scaleFactor,
    height: elHeight * scaleFactor
  }
}

// #region Copy image modal (Safari fallback)
const showSafariCopyImageModal = ref(false)
const copyModalIsLoading = ref(false)
const copyModalImageSrc = ref<string | null>(null)

async function openCopyModal() {
  copyModalIsLoading.value = true
  try {
    copyModalImageSrc.value = await getPngElement(buildImageExportInput())
    showSafariCopyImageModal.value = true
  } catch (error) {
    console.error('Error preparing image for copy modal:', error)
  } finally {
    copyModalIsLoading.value = false
  }
}

function closeCopyModal() {
  showSafariCopyImageModal.value = false
  copyModalImageSrc.value = null
}
// #endregion

function copyQRToClipboard() {
  if (IS_COPY_IMAGE_TO_CLIPBOARD_SUPPORTED) {
    copyImageToClipboard(buildImageExportInput())
  } else if (!isLikelyMobileDevice.value) {
    // for now we only open the copy image modal on safari desktop because
    // this modal will be hidden behind the export image modal on mobile viewport.
    openCopyModal()
  }
}

/**
 * Downloads QR code in specified format, handling both single and batch exports
 * @param format The format to download: 'png', 'svg', or 'jpg'
 */
function downloadQRImage(format: 'png' | 'svg' | 'jpg') {
  if (exportMode.value === ExportMode.Single) {
    // Sanitize filename to remove invalid characters
    const sanitizedFilename = (exportFilename.value || 'qr-code').replace(/[^a-zA-Z0-9_-]/g, '_')

    if (format === 'svg') {
      downloadSvgElement(buildSvgExportInput(), `${sanitizedFilename}.svg`)
    } else if (format === 'png') {
      downloadPngElement(buildImageExportInput(), `${sanitizedFilename}.png`)
    } else {
      downloadJpgElement(buildImageExportInput(), `${sanitizedFilename}.jpg`)
    }
  } else {
    generateBatchQRCodes(format)
  }
}

function buildSvgExportInput() {
  return {
    options: qrCodeProps.value,
    frame: showFrame.value
      ? {
          text: frameText.value,
          position: frameTextPosition.value,
          style: frameStyle.value,
          captionWidth: frameCaptionWidth.value,
          textTop: frameTextTop.value,
          textBottom: frameTextBottom.value,
          textColorTop: frameTextTopColor.value || undefined,
          textColorBottom: frameTextBottomColor.value || undefined,
          fontSizeTop: frameTextTopSize.value,
          fontSizeBottom: frameTextBottomSize.value,
          fontWeightTop: frameTextTopWeight.value || undefined,
          fontWeightBottom: frameTextBottomWeight.value || undefined,
          fontStyleTop: frameTextTopItalic.value || undefined,
          fontStyleBottom: frameTextBottomItalic.value || undefined,
          fontFamilyTop: frameTextTopFont.value || undefined,
          fontFamilyBottom: frameTextBottomFont.value || undefined
        }
      : null,
    outerBackground: styleBackground.value,
    borderRadius: exportBorderRadius.value,
    // SVG natural size: the QR's intrinsic dimensions. Frame chrome is added
    // by the lib's renderFramed primitive on top of this.
    size: { width: width.value, height: height.value }
  }
}

function buildImageExportInput() {
  const jpgBackground = styleBackground.value === 'transparent' ? '#ffffff' : styleBackground.value
  return {
    ...buildSvgExportInput(),
    // PNG/JPG final raster output dimensions — include any frame chrome
    // expansion that the in-app preview shows.
    targetSize: getExportDimensions(),
    jpgBackground
  }
}
//#endregion

//#region /* QR Config Utils - Saving, Loading and Downloading */
function buildCurrentQRConfig(): QRCodeConfig {
  return serializeQRConfig(
    qrCodeProps.value,
    style.value,
    showFrame.value ? (frameSettings.value as QRCodeFrameConfig) : null
  )
}

function downloadQRConfig() {
  console.debug('Downloading QR code config')
  const config = buildCurrentQRConfig()
  const blob = new Blob([JSON.stringify(config)], { type: 'application/json' })
  downloadBlob(blob, 'qr-code-config.json')
}

function applyQRConfig(config: QRCodeConfig, key?: string, options?: { restoreData?: boolean }) {
  const preset = {
    ...config.props,
    style: config.style
  } as Preset

  if (key) {
    preset.name = key
    lastCustomLoadedPreset.value = preset
    selectedPresetKey.value = key
  }

  selectedPreset.value = preset

  // Style presets deliberately never touch the user's data, but an explicitly
  // loaded config file is the user's own saved setup — restore its data too.
  if (options?.restoreData && typeof config.props.data === 'string' && config.props.data !== '') {
    data.value = config.props.data
  }

  if (config.frame) {
    showFrame.value = true
    frameText.value = config.frame.text || defaultFrameText.value
    frameTextPosition.value = config.frame.position || 'bottom'
    frameTextTop.value = config.frame.textTop || ''
    frameTextBottom.value = config.frame.textBottom || ''
    frameTextTopSize.value = config.frame.fontSizeTop ?? 18
    frameTextBottomSize.value = config.frame.fontSizeBottom ?? 18
    frameTextTopColor.value = config.frame.textColorTop || ''
    frameTextBottomColor.value = config.frame.textColorBottom || ''
    frameTextTopWeight.value = config.frame.fontWeightTop || 'normal'
    frameTextBottomWeight.value = config.frame.fontWeightBottom || 'normal'
    frameTextTopItalic.value = config.frame.fontStyleTop || 'normal'
    frameTextBottomItalic.value = config.frame.fontStyleBottom || 'normal'
    frameTextTopFont.value = config.frame.fontFamilyTop || ''
    frameTextBottomFont.value = config.frame.fontFamilyBottom || ''

    if (!frameTextTop.value && !frameTextBottom.value && config.frame.text) {
      if (config.frame.position === 'top') {
        frameTextTop.value = config.frame.text
      } else {
        frameTextBottom.value = config.frame.text
      }
    }

    // Stored configs keep the derived caption width; restore the user-facing
    // frame width from it (clamped to the valid range).
    frameWidth.value = Math.min(
      FRAME_WIDTH_MAX,
      Math.max(
        FRAME_WIDTH_MIN,
        Math.round((config.frame.captionWidth ?? 200) + PREVIEW_QRCODE_DIM_UNIT)
      )
    )
    frameCaptionWidth.value = frameWidth.value - PREVIEW_QRCODE_DIM_UNIT
    frameStyle.value = { ...frameStyle.value, ...config.frame.style }

    const restoredFontFamily = config.frame.style.fontFamily
    if (restoredFontFamily) {
      loadFrameFont(restoredFontFamily)
    }
    if (config.frame.fontFamilyTop) {
      loadFrameFont(config.frame.fontFamilyTop)
    }
    if (config.frame.fontFamilyBottom) {
      loadFrameFont(config.frame.fontFamilyBottom)
    }

    const framePreset: any = {
      name: key || LAST_LOADED_LOCALLY_PRESET_KEY,
      style: config.frame.style,
      text: config.frame.text,
      position: config.frame.position,
      textTop: config.frame.textTop,
      textBottom: config.frame.textBottom,
      textColorTop: config.frame.textColorTop,
      textColorBottom: config.frame.textColorBottom,
      fontSizeTop: config.frame.fontSizeTop,
      fontSizeBottom: config.frame.fontSizeBottom,
      fontWeightTop: config.frame.fontWeightTop,
      fontWeightBottom: config.frame.fontWeightBottom,
      fontStyleTop: config.frame.fontStyleTop,
      fontStyleBottom: config.frame.fontStyleBottom,
      fontFamilyTop: config.frame.fontFamilyTop,
      fontFamilyBottom: config.frame.fontFamilyBottom
    }

    if (key) {
      lastCustomLoadedFramePreset.value = framePreset
      selectedFramePresetKey.value = key
    }
  }
}

function applyQRConfigFromJsonString(
  jsonString: string,
  key?: string,
  options?: { restoreData?: boolean }
) {
  try {
    const config: unknown = JSON.parse(jsonString)
    // Same gate as the localStorage restore path (loadQRConfig) — config
    // files are user-provided input and must not smuggle e.g. a javascript:
    // logo URL into the image sinks.
    if (!isValidQRCodeConfig(config)) {
      console.error('Invalid QR code config, ignoring it')
      return
    }
    applyQRConfig(config as QRCodeConfig, key, options)
  } catch {
    console.error('Failed to parse QR code config JSON')
  }
}

function loadQrConfigFromFile() {
  console.debug('Loading QR code config from file')
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.accept = 'application/json'
  fileInput.onchange = (event: Event) => {
    const target = event.target as HTMLInputElement
    if (target.files) {
      const reader = new FileReader()
      reader.onload = (e: ProgressEvent<FileReader>) => {
        applyQRConfigFromJsonString(
          (e.target as FileReader).result as string,
          LOADED_FROM_FILE_PRESET_KEY,
          {
            restoreData: true
          }
        )
      }
      reader.readAsText(target.files[0])
    }
  }
  fileInput.click()
}

watch(
  [qrCodeProps, style, showFrame, frameSettings],
  () => {
    if (isLocalStorageEnabled()) {
      saveQRConfig(buildCurrentQRConfig())
    }
  },
  { deep: true }
)

onMounted(() => {
  if (isLocalStorageEnabled()) {
    const storedConfig = loadQRConfig()
    if (storedConfig) {
      applyQRConfig(storedConfig, LAST_LOADED_LOCALLY_PRESET_KEY)
    } else {
      selectedPreset.value = { ...defaultPreset }
      selectedPresetKey.value = defaultPreset.name
    }
  }

  if (!showFrame.value) {
    const framePreset = allFramePresets.find((p) => p.name === selectedFramePresetKey.value)
    if (framePreset) {
      applyFramePreset(framePreset, false)
    }
  } else {
    // Re-apply frame styles after mount so UI matches env/QR preset (avoids stale defaults)
    const preset = selectedPreset.value as Preset & { frame?: QRCodeFrameConfig }
    if (preset.frame) {
      applyFrameFromPreset(preset.frame)
    } else {
      const framePreset = allFramePresets.find((p) => p.name === selectedFramePresetKey.value)
      if (framePreset) {
        applyFramePreset(framePreset)
      }
    }
  }

  // Set initial data if provided through props
  if (props.initialData) {
    data.value = props.initialData
  } else if (data.value.trim() === '') {
    data.value = defaultQRCodeText.value
  }
})
//#endregion

//#region /* Batch QR Code Generation */
enum ExportMode {
  Single = 'single',
  Batch = 'batch'
}

const exportFilename = ref('qr-code')
const isTextExportModalOpen = ref(false)
const isMobileExportDrawerOpen = ref(false)
const asciiMatrix = computed<boolean[][]>(() => {
  if (!data.value) return []
  try {
    return buildMatrix(data.value, errorCorrectionLevel.value).matrix
  } catch (err) {
    console.error('Failed to build matrix for ASCII export:', err)
    return []
  }
})

const asciiBatchRows = computed(() =>
  dataStringsFromCsv.value.map((data, i) => ({
    data,
    fileName: fileNamesFromCsv.value[i] ?? `qr-${i}`
  }))
)

function openTextExportModal() {
  isMobileExportDrawerOpen.value = false
  isTextExportModalOpen.value = true
}
const exportMode = ref(ExportMode.Single)
const dataStringsFromCsv = ref<string[]>([])
const frameTextsFromCsv = ref<string[]>([])
const fileNamesFromCsv = ref<string[]>([])
const fontFamiliesFromCsv = ref<string[]>([])

const inputFileForBatchEncoding = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const isValidCsv = ref(true)

const isExportingBatchQRs = ref(false)
const isBatchExportSuccess = ref(false)
const currentExportedQrCodeIndex = ref<number | null>(null)

const parsedCsvResult = ref<CSVParsingResult | null>(null)
const previewRowIndex = ref(0)

const resetBatchExportProgress = () => {
  isExportingBatchQRs.value = false
  currentExportedQrCodeIndex.value = null
  usedFilenames.clear()
}

const isBatchInputFileValidationFailed = computed(() => !isValidCsv.value)
const isBatchExportRunning = computed(() => isExportingBatchQRs.value)

const resetData = () => {
  data.value = ''
  inputFileForBatchEncoding.value = null
  dataStringsFromCsv.value = []
  frameTextsFromCsv.value = []
  fileNamesFromCsv.value = []
  fontFamiliesFromCsv.value = []
  isValidCsv.value = true
  resetBatchExportProgress()
  isBatchExportSuccess.value = false
}

function resetBatchExport() {
  resetData()
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const framePositions: Array<'top' | 'bottom' | 'left' | 'right'> = [
  'top',
  'bottom',
  'right',
  'left'
]

watch(exportMode, () => {
  resetData()
})

watch(previewRowIndex, (newIndex) => {
  if (
    exportMode.value === ExportMode.Batch &&
    dataStringsFromCsv.value.length > 0 &&
    newIndex >= 0 &&
    newIndex < dataStringsFromCsv.value.length
  ) {
    data.value = dataStringsFromCsv.value[newIndex]
    frameText.value = frameTextsFromCsv.value[newIndex] || defaultFrameText.value
    const fontFamily = fontFamiliesFromCsv.value[newIndex]
    if (fontFamily !== undefined) {
      onFontFamilyChange(fontFamily)
    }
  }
})

const getFileFromInputEvent = (event: InputEvent) => {
  const inputElement = event.target as HTMLInputElement
  if (inputElement.files && inputElement.files.length > 0) {
    return inputElement.files[0]
  }
  return null
}

const onBatchInputFileUpload = (event: Event) => {
  isBatchExportSuccess.value = false
  let file: File | null = getFileFromInputEvent(event as InputEvent)

  // If it is not input event, then it might be a drag and drop event
  if (file == null) {
    const dt = (event as DragEvent).dataTransfer
    if (!dt || !dt.files || dt.files.length === 0) {
      return
    }
    file = dt.files[0]
  }

  inputFileForBatchEncoding.value = file
  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target?.result
    if (typeof content !== 'string') {
      isValidCsv.value = false
      return
    }

    const result = parseCSV(content)
    parsedCsvResult.value = result
    if (!result.isValid) {
      isValidCsv.value = false
      return
    }

    if (!validateCSVData(result.data)) {
      isValidCsv.value = false
      return
    }

    // Process CSV data using the utility function
    const batchResult = processCsvDataForBatch(result.data)

    dataStringsFromCsv.value = batchResult.urls
    frameTextsFromCsv.value = batchResult.frameTexts
    fileNamesFromCsv.value = batchResult.fileNames
    fontFamiliesFromCsv.value = batchResult.fontFamilies
    showFrame.value = batchResult.hasCustomFrameText
    isValidCsv.value = true
    previewRowIndex.value = 0 // Reset preview to first row on new upload

    // Update the QR code preview with the first row's data
    if (batchResult.urls.length > 0) {
      data.value = batchResult.urls[0]
      frameText.value = batchResult.frameTexts[0] || defaultFrameText.value
      const firstFontFamily = batchResult.fontFamilies[0]
      if (firstFontFamily) {
        onFontFamilyChange(firstFontFamily)
      }
    }
  }

  reader.readAsText(file)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const usedFilenames = new Set<string>()
const createZipFile = (
  zip: typeof JSZip,
  dataUrl: string,
  index: number,
  format: 'png' | 'svg' | 'jpg'
) => {
  const dataString = dataStringsFromCsv.value[index]
  const frameText = frameTextsFromCsv.value[index]
  const customFileName = fileNamesFromCsv.value[index]

  const fileName = generateBatchExportFilename(
    dataString,
    frameText,
    customFileName,
    index,
    usedFilenames
  )

  // Sanitize filename to remove invalid characters
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9_-]/g, '_')

  if (format === 'png' || format === 'jpg') {
    zip.file(`${sanitizedFileName}.${format}`, dataUrl.split(',')[1], { base64: true })
  } else {
    // For SVG, we don't need to split and use base64
    zip.file(`${sanitizedFileName}.${format}`, dataUrl)
  }
}
async function generateBatchQRCodes(format: 'png' | 'svg' | 'jpg') {
  isExportingBatchQRs.value = true
  const zip = new JSZip()
  let numQrCodesCreated = 0

  try {
    for (let index = 0; index < dataStringsFromCsv.value.length; index++) {
      currentExportedQrCodeIndex.value = index
      const url = dataStringsFromCsv.value[index]
      const currentFrameText = frameTextsFromCsv.value[index]
      const currentFontFamily = fontFamiliesFromCsv.value[index]
      data.value = url
      frameText.value = currentFrameText
      if (currentFontFamily !== undefined) {
        await onFontFamilyChange(currentFontFamily)
      }
      await sleep(1000)
      let dataUrl: string = ''
      if (format === 'png') {
        dataUrl = await getPngElement(buildImageExportInput())
      } else if (format === 'jpg') {
        dataUrl = await getJpgElement(buildImageExportInput())
      } else {
        dataUrl = await getInlinedSvgString(buildSvgExportInput())
      }
      createZipFile(zip, dataUrl, index, format)
      numQrCodesCreated++
    }

    while (numQrCodesCreated !== dataStringsFromCsv.value.length) {
      await sleep(100)
    }

    zip.generateAsync({ type: 'blob' }).then((content) => {
      downloadBlob(content, 'qr-codes.zip')
      isBatchExportSuccess.value = true
    })
  } catch (error) {
    console.error('Error generating batch QR codes', error)
    isBatchExportSuccess.value = false
  } finally {
    resetBatchExportProgress()
  }
}
// #endregion

const activeStyleTab = ref('datatype')

const activeTabLeft = computed(() => {
  switch (activeStyleTab.value) {
    case 'datatype':
      return '2px'
    case 'style':
      return 'calc(25% + 1px)'
    case 'eyestyle':
      return 'calc(50% + 1px)'
    case 'logo':
      return 'calc(75% + 1px)'
    default:
      return '2px'
  }
})

const showRawDataCopied = ref(false)
const copyRawData = async () => {
  if (!data.value) return
  try {
    await navigator.clipboard.writeText(data.value)
    showRawDataCopied.value = true
    setTimeout(() => {
      showRawDataCopied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy raw data', err)
  }
}

const isQRAnimating = ref(false)
let qrAnimTimeout1: ReturnType<typeof setTimeout>
let qrAnimTimeout2: ReturnType<typeof setTimeout>

watch(
  qrCodeProps,
  () => {
    isQRAnimating.value = false
    clearTimeout(qrAnimTimeout1)
    clearTimeout(qrAnimTimeout2)
    qrAnimTimeout1 = setTimeout(() => {
      isQRAnimating.value = true
      qrAnimTimeout2 = setTimeout(() => {
        isQRAnimating.value = false
      }, 400)
    }, 10)
  },
  { deep: true }
)

const decodedDataMeta = computed(() => {
  const raw = data.value || ''
  if (!raw) {
    return {
      type: 'empty',
      title: t('ไม่มีข้อมูล') || 'ไม่มีข้อมูล',
      details: [],
      icon: Info,
      color: 'border-zinc-200/50 bg-zinc-50/20 text-zinc-500'
    }
  }

  // 1. WiFi
  if (raw.startsWith('WIFI:')) {
    const ssidMatch = /S:([^;]+)/.exec(raw)
    const passMatch = /P:([^;]+)/.exec(raw)
    const typeMatch = /T:([^;]+)/.exec(raw)
    const ssid = ssidMatch ? ssidMatch[1] : 'Unknown'
    const pass = passMatch ? passMatch[1] : ''
    const enc = typeMatch ? typeMatch[1] : 'WPA'
    return {
      type: 'wifi',
      title: t('เครือข่าย Wi-Fi') || 'เครือข่าย Wi-Fi',
      details: [
        { label: t('SSID / ชื่อเครือข่าย') || 'SSID / ชื่อเครือข่าย', value: ssid },
        { label: t('ระบบความปลอดภัย') || 'ระบบความปลอดภัย', value: enc },
        { label: t('รหัสผ่าน') || 'รหัสผ่าน', value: pass ? '••••••••' : t('ไม่มีรหัสผ่าน') || 'ไม่มีรหัสผ่าน' }
      ],
      icon: Wifi,
      color: 'border-emerald-200/50 bg-emerald-50/10 text-emerald-600 dark:border-emerald-900/30 dark:bg-emerald-950/5'
    }
  }

  // 2. Email
  if (raw.startsWith('mailto:') || raw.startsWith('MATMSG:')) {
    let to = ''
    let sub = ''
    if (raw.startsWith('mailto:')) {
      to = raw.slice(7).split('?')[0] || ''
      const subMatch = /subject=([^&]+)/.exec(raw)
      sub = subMatch ? decodeURIComponent(subMatch[1]) : ''
    } else {
      const toMatch = /TO:([^;]+)/.exec(raw)
      const subMatch = /SUB:([^;]+)/.exec(raw)
      to = toMatch ? toMatch[1] : ''
      sub = subMatch ? subMatch[1] : ''
    }
    return {
      type: 'email',
      title: t('ส่งอีเมล') || 'ส่งอีเมล',
      details: [
        { label: t('ถึง (Email)') || 'ถึง (Email)', value: to },
        { label: t('หัวข้อ') || 'หัวข้อ', value: sub || t('ไม่มีหัวข้อ') || 'ไม่มีหัวข้อ' }
      ],
      icon: Mail,
      color: 'border-cyan-200/50 bg-cyan-50/10 text-cyan-600 dark:border-cyan-900/30 dark:bg-cyan-950/5'
    }
  }

  // 3. Contact Card (vCard)
  if (raw.startsWith('BEGIN:VCARD')) {
    const fnMatch = /FN:([^\n]+)/.exec(raw)
    const telMatch = /TEL:([^\n]+)/.exec(raw)
    const emailMatch = /EMAIL:([^\n]+)/.exec(raw)
    const name = fnMatch ? fnMatch[1].trim() : 'Contact'
    const phone = telMatch ? telMatch[1].trim() : ''
    const email = emailMatch ? emailMatch[1].trim() : ''
    return {
      type: 'vcard',
      title: t('บัตรติดต่อ (vCard)') || 'บัตรติดต่อ (vCard)',
      details: [
        { label: t('ชื่อ-นามสกุล') || 'ชื่อ-นามสกุล', value: name },
        { label: t('เบอร์โทรศัพท์') || 'เบอร์โทรศัพท์', value: phone || '-' },
        { label: t('อีเมล') || 'อีเมล', value: email || '-' }
      ],
      icon: User,
      color: 'border-indigo-200/50 bg-indigo-50/10 text-indigo-600 dark:border-indigo-900/30 dark:bg-indigo-950/5'
    }
  }

  // 4. Phone
  if (raw.startsWith('tel:')) {
    const num = raw.slice(4)
    return {
      type: 'phone',
      title: t('โทรออก') || 'โทรออก',
      details: [
        { label: t('เบอร์โทรศัพท์') || 'เบอร์โทรศัพท์', value: num }
      ],
      icon: Phone,
      color: 'border-blue-200/50 bg-blue-50/10 text-blue-600 dark:border-blue-900/30 dark:bg-blue-950/5'
    }
  }

  // 5. SMS
  if (raw.startsWith('sms:') || raw.startsWith('smsto:')) {
    const parts = raw.split(':')
    const phone = parts[1] || ''
    const body = parts[2] ? decodeURIComponent(parts[2]) : ''
    return {
      type: 'sms',
      title: t('ส่งข้อความ SMS') || 'ส่งข้อความ SMS',
      details: [
        { label: t('เบอร์ปลายทาง') || 'เบอร์ปลายทาง', value: phone },
        { label: t('ข้อความ') || 'ข้อความ', value: body || '-' }
      ],
      icon: MessageSquare,
      color: 'border-violet-200/50 bg-violet-50/10 text-violet-600 dark:border-violet-900/30 dark:bg-violet-950/5'
    }
  }

  // 6. Location
  if (raw.startsWith('geo:')) {
    const coords = raw.slice(4).split('?')[0]
    return {
      type: 'location',
      title: t('พิกัดแผนที่ (Location)') || 'พิกัดแผนที่ (Location)',
      details: [
        { label: t('ละติจูด, ลองจิจูด') || 'ละติจูด, ลองจิจูด', value: coords }
      ],
      icon: MapPin,
      color: 'border-rose-200/50 bg-rose-50/10 text-rose-600 dark:border-rose-900/30 dark:bg-rose-950/5'
    }
  }

  // 7. Event (Calendar)
  if (raw.startsWith('BEGIN:VEVENT')) {
    const summaryMatch = /SUMMARY:([^\n]+)/.exec(raw)
    const locMatch = /LOCATION:([^\n]+)/.exec(raw)
    const title = summaryMatch ? summaryMatch[1].trim() : 'Event'
    const location = locMatch ? locMatch[1].trim() : ''
    return {
      type: 'event',
      title: t('กิจกรรม (Calendar)') || 'กิจกรรม (Calendar)',
      details: [
        { label: t('หัวข้อกิจกรรม') || 'หัวข้อกิจกรรม', value: title },
        { label: t('สถานที่') || 'สถานที่', value: location || '-' }
      ],
      icon: Calendar,
      color: 'border-orange-200/50 bg-orange-50/10 text-orange-600 dark:border-orange-900/30 dark:bg-orange-950/5'
    }
  }

  // 8. URL (including Shared Files Link)
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    // Check if it is a shared file link
    if (raw.includes('?id=')) {
      return {
        type: 'files',
        title: t('ไฟล์แชร์สาธารณะ (ZIP)') || 'ไฟล์แชร์สาธารณะ (ZIP)',
        details: [
          { label: t('สถานะ') || 'สถานะ', value: t('พร้อมดาวน์โหลดผ่านคิวอาร์โค้ด') || 'พร้อมดาวน์โหลดผ่านคิวอาร์โค้ด' },
          { label: t('ลิงก์เข้าถึง') || 'ลิงก์เข้าถึง', value: raw }
        ],
        icon: FileArchive,
        color: 'border-amber-200/50 bg-amber-50/10 text-amber-600 dark:border-amber-900/30 dark:bg-amber-950/5'
      }
    }
    return {
      type: 'url',
      title: t('ลิงก์เว็บไซต์ (URL)') || 'ลิงก์เว็บไซต์ (URL)',
      details: [
        { label: t('ที่อยู่เว็บ') || 'ที่อยู่เว็บ', value: raw }
      ],
      icon: Globe,
      color: 'border-blue-200/50 bg-blue-50/10 text-blue-600 dark:border-blue-900/30 dark:bg-blue-950/5'
    }
  }

  // 9. Plain Text
  return {
    type: 'text',
    title: t('ข้อความทั่วไป (Plain Text)') || 'ข้อความทั่วไป (Plain Text)',
    details: [
      { label: t('ข้อมูลข้อความ') || 'ข้อมูลข้อความ', value: raw.length > 50 ? raw.slice(0, 50) + '...' : raw }
    ],
    icon: Type,
    color: 'border-zinc-200/50 bg-zinc-50/10 text-zinc-600 dark:border-zinc-800/60 dark:bg-zinc-900/10'
  }
})

const onFilenameKeypress = (event: KeyboardEvent) => {
  const invalidChars = /[\\/:*?"<>|]/
  if (invalidChars.test(event.key)) {
    event.preventDefault()
  }
}
</script>

<template>
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start lg:pb-0">
    <!-- Sticky preview sidebar for desktop -->
    <div
      v-if="isLarge"
      ref="mainContentContainer"
      id="main-content-container"
      class="glass-card sticky top-8 flex w-full flex-col items-center justify-center border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-5"
    ></div>

    <!-- Bottom drawer preview for mobile -->
    <Drawer v-else v-model:open="isMobileExportDrawerOpen">
      <DrawerTrigger
        id="drawer-preview-container"
        class="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-zinc-200 bg-white/95 shadow-2xl outline-none backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95"
      >
        <div class="flex flex-col items-center pb-2">
          <div class="mt-2.5 h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700"></div>
          <div :class="['w-full', showFrame ? 'py-1' : '-my-8']">
            <div
              :class="[
                'flex items-center justify-center',
                !showFrame && 'origin-center scale-[0.7]',
                { 'qr-pulse-entrance': isQRAnimating }
              ]"
            >
              <FitScaleBox v-if="showFrame" :viewport-margin="32" :max-height="150">
                <QRCodeFrame
                  :frame-text="frameText"
                  :text-position="frameTextPosition"
                  :frame-style="frameStyle"
                  :caption-width="frameCaptionWidth"
                  :frame-text-top="frameTextTop"
                  :frame-text-bottom="frameTextBottom"
                  :text-color-top="frameTextTopColor"
                  :text-color-bottom="frameTextBottomColor"
                  :font-size-top="frameTextTopSize"
                  :font-size-bottom="frameTextBottomSize"
                  :font-weight-top="frameTextTopWeight"
                  :font-weight-bottom="frameTextBottomWeight"
                  :font-style-top="frameTextTopItalic"
                  :font-style-bottom="frameTextBottomItalic"
                  :font-family-top="frameTextTopFont"
                  :font-family-bottom="frameTextBottomFont"
                >
                  <template #qr-code>
                    <div id="qr-code-container" class="grid place-items-center">
                      <div
                        class="grid place-items-center overflow-hidden"
                        :style="[
                          style,
                          {
                            width: `${PREVIEW_QRCODE_DIM_UNIT}px`,
                            height: `${PREVIEW_QRCODE_DIM_UNIT}px`
                          }
                        ]"
                      >
                        <StyledQRCode
                          v-bind="{
                            ...qrCodeProps,
                            width: PREVIEW_QRCODE_DIM_UNIT,
                            height: PREVIEW_QRCODE_DIM_UNIT
                          }"
                          role="img"
                          aria-label="QR code"
                        />
                      </div>
                    </div>
                  </template>
                </QRCodeFrame>
              </FitScaleBox>
              <template v-else>
                <div class="grid place-items-center">
                  <div
                    class="grid place-items-center overflow-hidden"
                    :style="[
                      style,
                      {
                        width: `${PREVIEW_QRCODE_DIM_UNIT}px`,
                        height: `${PREVIEW_QRCODE_DIM_UNIT}px`
                      }
                    ]"
                  >
                    <StyledQRCode
                      v-bind="{
                        ...qrCodeProps,
                        width: PREVIEW_QRCODE_DIM_UNIT,
                        height: PREVIEW_QRCODE_DIM_UNIT
                      }"
                      role="img"
                      aria-label="QR code preview"
                    />
                  </div>
                </div>
              </template>
            </div>
          </div>
          <div class="flex items-center gap-1.5 text-xs font-bold text-zinc-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path d="m18 15-6-6-6 6" />
            </svg>
            <span>{{ t('Export') }}</span>
          </div>
        </div>
      </DrawerTrigger>
      <DrawerContent class="bg-white dark:bg-zinc-950">
        <DrawerHeader>
          <DrawerTitle class="text-center text-xs font-bold text-zinc-800 dark:text-zinc-200">{{
            t('Export QR code')
          }}</DrawerTitle>
        </DrawerHeader>
        <div class="overflow-y-auto overflow-x-hidden px-4 pb-6">
          <div ref="mainContentContainer" id="main-content-container" class="w-full"></div>
        </div>
      </DrawerContent>
    </Drawer>

    <!-- Left Column: Controls & Configurations -->
    <div class="flex w-full flex-col gap-6 text-start lg:col-span-7">
      <!-- User Guide Card -->
      <div
        v-if="showUserGuide"
        class="glass-card border border-amber-200/50 bg-amber-50/10 p-5 shadow-sm dark:border-amber-900/30 dark:bg-amber-950/5"
      >
        <div class="flex items-center gap-2 border-b border-zinc-200/60 pb-3 dark:border-zinc-800/60">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-amber-500 dark:text-amber-400">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <h3 class="text-zinc-750 dark:text-zinc-250 text-xs font-bold uppercase tracking-wider">
            {{ t('User Guide') }}
          </h3>
        </div>
        
        <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <!-- Step 1 -->
          <div class="flex gap-3 rounded-xl border border-zinc-200/60 bg-white/50 p-3 transition-colors hover:border-blue-500/30 dark:border-zinc-800/60 dark:bg-zinc-900/30">
            <div class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-xs font-bold text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              1
            </div>
            <div class="min-w-0 flex-1 space-y-0.5">
              <h4 class="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                {{ t('1. Select Data Type') }}
              </h4>
              <p class="text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                {{ t('Select your preferred content type (Text, Link, Wi-Fi, Files, etc.)') }}
              </p>
              <!-- Animation block -->
              <div class="mt-2 flex items-center justify-start gap-1.5">
                <div class="animate-pulse-slow size-3 rounded border border-blue-500 bg-blue-500/10"></div>
                <div class="size-3 rounded border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800"></div>
                <div class="size-3 rounded border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800"></div>
              </div>
            </div>
          </div>

          <!-- Step 2 -->
          <div class="flex gap-3 rounded-xl border border-zinc-200/60 bg-white/50 p-3 transition-colors hover:border-blue-500/30 dark:border-zinc-800/60 dark:bg-zinc-900/30">
            <div class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-xs font-bold text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              2
            </div>
            <div class="min-w-0 flex-1 space-y-0.5">
              <h4 class="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                {{ t('2. Enter Details') }}
              </h4>
              <p class="text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                {{ t('Fill out the fields in the form to populate your QR Code data.') }}
              </p>
              <!-- Animation block -->
              <div class="h-4.5 mt-2 flex w-24 items-center gap-1 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 dark:border-zinc-700 dark:bg-zinc-950/40">
                <span class="scale-[0.9] font-mono text-[8px] text-zinc-400">https://</span>
                <span class="animate-blink h-2.5 w-0.5 bg-blue-500"></span>
              </div>
            </div>
          </div>

          <!-- Step 3 -->
          <div class="flex gap-3 rounded-xl border border-zinc-200/60 bg-white/50 p-3 transition-colors hover:border-blue-500/30 dark:border-zinc-800/60 dark:bg-zinc-900/30">
            <div class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-xs font-bold text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              3
            </div>
            <div class="min-w-0 flex-1 space-y-0.5">
              <h4 class="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                {{ t('3. Customize Design') }}
              </h4>
              <p class="text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                {{ t('Choose presets, colors, dots style, or embed your center logo.') }}
              </p>
              <!-- Animation block -->
              <div class="mt-2 flex items-center justify-start gap-1.5">
                <span class="animate-pulse-slow size-2.5 rounded-full bg-rose-500" style="animation-duration: 1.5s;"></span>
                <span class="animate-pulse-slow size-2.5 rounded-full bg-emerald-500" style="animation-duration: 2s;"></span>
                <span class="animate-pulse-slow size-2.5 rounded-full bg-blue-500" style="animation-duration: 2.5s;"></span>
              </div>
            </div>
          </div>

          <!-- Step 4 -->
          <div class="flex gap-3 rounded-xl border border-zinc-200/60 bg-white/50 p-3 transition-colors hover:border-blue-500/30 dark:border-zinc-800/60 dark:bg-zinc-900/30">
            <div class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-xs font-bold text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              4
            </div>
            <div class="min-w-0 flex-1 space-y-0.5">
              <h4 class="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                {{ t('4. Export QR Code') }}
              </h4>
              <p class="text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                {{ t('Download your high-resolution QR Code in PNG, JPG, or SVG format.') }}
              </p>
              <!-- Animation block -->
              <div class="mt-2 flex items-center gap-1">
                <div class="h-4.5 flex items-center justify-center rounded border border-blue-500/30 bg-blue-50 px-1.5 py-0.5 dark:bg-blue-950/20">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="animate-slide-down text-blue-600 dark:text-blue-400">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <polyline points="19 12 12 19 5 12"></polyline>
                  </svg>
                  <span class="ml-1 text-[8px] font-bold text-blue-600 dark:text-blue-400">PNG</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- Combined Controls Card -->
      <div
        class="glass-card border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40"
      >
        <!-- Tabs Header Bar -->
        <div
          class="no-scrollbar relative mb-5 grid grid-cols-4 gap-1 border-b border-zinc-200/60 p-0.5 pb-2 dark:border-zinc-800/60"
        >
          <!-- Sliding Tab Background Pill -->
          <div
            class="duration-350 dark:bg-zinc-850 absolute bottom-2.5 top-0.5 rounded-lg bg-zinc-100 transition-all"
            :style="{
              left: activeTabLeft,
              width: 'calc(25% - 2px)',
              transitionTimingFunction: 'var(--ease-out-expo)'
            }"
          ></div>

          <button
            type="button"
            @click="activeStyleTab = 'datatype'"
            :class="[
              'relative z-10 px-1 py-1.5 text-center text-[10px] font-bold outline-none transition-colors duration-300 sm:text-xs',
              activeStyleTab === 'datatype'
                ? 'text-zinc-900 dark:text-zinc-100'
                : 'hover:text-zinc-650 text-zinc-400 dark:hover:text-zinc-300'
            ]"
          >
            {{ t('Data Type') }}
          </button>
          <button
            type="button"
            @click="activeStyleTab = 'style'"
            :class="[
              'relative z-10 px-1 py-1.5 text-center text-[10px] font-bold outline-none transition-colors duration-300 sm:text-xs',
              activeStyleTab === 'style'
                ? 'text-zinc-900 dark:text-zinc-100'
                : 'hover:text-zinc-650 text-zinc-400 dark:hover:text-zinc-300'
            ]"
          >
            {{ t('Style Settings') }}
          </button>
          <button
            type="button"
            @click="activeStyleTab = 'eyestyle'"
            :class="[
              'relative z-10 px-1 py-1.5 text-center text-[10px] font-bold outline-none transition-colors duration-300 sm:text-xs',
              activeStyleTab === 'eyestyle'
                ? 'text-zinc-900 dark:text-zinc-100'
                : 'hover:text-zinc-650 text-zinc-400 dark:hover:text-zinc-300'
            ]"
          >
            {{ t('Eye & Frame Settings') }}
          </button>
          <button
            type="button"
            @click="activeStyleTab = 'logo'"
            :class="[
              'relative z-10 px-1 py-1.5 text-center text-[10px] font-bold outline-none transition-colors duration-300 sm:text-xs',
              activeStyleTab === 'logo'
                ? 'text-zinc-900 dark:text-zinc-100'
                : 'hover:text-zinc-650 text-zinc-400 dark:hover:text-zinc-300'
            ]"
          >
            {{ t('Logo & Center Settings') }}
          </button>
        </div>

        <!-- 1. DATA TYPE TAB -->
        <div v-if="isAutomation || activeStyleTab === 'datatype'" class="space-y-4">
          <div
            class="dark:border-zinc-850 mb-4 flex items-center justify-between border-b border-zinc-100 pb-3"
          >
            <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-500">
              {{ t('ประเภทการป้อนข้อมูล') }}
            </h3>

          <!-- Mode Toggles -->
          <div
            class="relative flex w-[170px] items-center gap-0.5 rounded-xl border border-zinc-200/50 bg-zinc-100 p-0.5 dark:border-zinc-700/50 dark:bg-zinc-800"
          >
            <!-- Sliding background pill -->
            <div
              class="duration-350 absolute inset-y-0.5 rounded-lg bg-white shadow-sm transition-all dark:bg-zinc-700"
              :style="{
                left: exportMode === ExportMode.Single ? '2px' : 'calc(50% + 1px)',
                width: 'calc(50% - 3px)',
                transitionTimingFunction: 'var(--ease-out-expo)'
              }"
            ></div>

            <button
              type="button"
              :class="[
                'relative z-10 flex-1 rounded-lg py-1 text-[11px] font-bold outline-none transition-colors duration-300',
                exportMode === ExportMode.Single
                  ? 'text-zinc-900 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              ]"
              @click="exportMode = ExportMode.Single"
            >
              {{ $t('Single export') }}
            </button>
            <button
              type="button"
              :class="[
                'relative z-10 flex-1 rounded-lg py-1 text-[11px] font-bold outline-none transition-colors duration-300',
                exportMode === ExportMode.Batch
                  ? 'text-zinc-900 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              ]"
              @click="exportMode = ExportMode.Batch"
            >
              {{ $t('Batch export') }}
            </button>
          </div>
        </div>

        <!-- Single QR Data Entry -->
        <div v-if="exportMode === ExportMode.Single" class="w-full">
          <InlineDataTemplates v-model="data" />
        </div>

        <!-- Batch CSV Data Entry -->
        <div v-else class="w-full space-y-4">
          <template v-if="!inputFileForBatchEncoding">
            <BatchExportFieldsGuide />
            <button
              type="button"
              class="upload-dropzone-pulse duration-350 flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 p-6 text-center transition-all hover:scale-[1.01] hover:bg-zinc-50/50 dark:border-zinc-800/80 dark:hover:bg-zinc-900/20"
              :style="{ transitionTimingFunction: 'var(--ease-out-expo)' }"
              @click="fileInput?.click()"
              @keyup.enter="fileInput?.click()"
              @keyup.space="fileInput?.click()"
              @dragover.prevent
              @drop.prevent="onBatchInputFileUpload"
              aria-label="Choose a CSV file"
            >
              <UploadCloud
                class="mb-2 size-10 text-zinc-400 transition-transform duration-300 hover:-translate-y-0.5 dark:text-zinc-600"
              />
              <p class="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {{ $t('Upload a CSV file') }}
              </p>
              <p class="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">
                ลากไฟล์ CSV มาวางตรงนี้ หรือคลิกเพื่อค้นหา
              </p>
            </button>
            <input
              ref="fileInput"
              type="file"
              accept=".csv,.txt"
              class="hidden"
              @change="onBatchInputFileUpload"
            />
            <p
              v-if="isBatchInputFileValidationFailed"
              class="mt-2 text-xs font-medium text-red-500"
            >
              ❌ {{ t('Invalid CSV file schema.') }}
            </p>
          </template>

          <template v-else>
            <div
              class="flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-zinc-800"
            >
              <div class="flex flex-col">
                <span class="text-xs font-bold text-zinc-700 dark:text-zinc-300"
                  >ความคืบหน้าของไฟล์ CSV</span
                >
                <span class="text-[10px] text-zinc-400 dark:text-zinc-500"
                  >อัปโหลดเรียบร้อย: {{ parsedCsvResult?.data?.length || 0 }} รายการ</span
                >
              </div>
              <button
                type="button"
                @click="resetBatchExport"
                class="text-xs font-semibold text-red-500 outline-none hover:text-red-600"
              >
                {{ t('ล้างข้อมูล') }}
              </button>
            </div>

            <!-- CSV Row Preview & Editor -->
            <div
              v-if="dataStringsFromCsv.length > 0"
              class="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-950/20"
            >
              <div
                class="dark:border-zinc-850 mb-3 flex items-center justify-between border-b border-zinc-200/60 pb-2"
              >
                <span class="text-xs font-semibold text-zinc-500">{{
                  $t('Edit & Preview Row')
                }}</span>
                <span class="font-mono text-xs font-bold text-zinc-600 dark:text-zinc-300">
                  {{ previewRowIndex + 1 }} / {{ dataStringsFromCsv.length }}
                </span>
              </div>
              <div class="space-y-3">
                <!-- Data Input (Text/URL) -->
                <div>
                  <span
                    class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-400"
                    >{{ $t('QR Code Data / Message') }}</span
                  >
                  <textarea
                    v-model="dataStringsFromCsv[previewRowIndex]"
                    @input="data = dataStringsFromCsv[previewRowIndex]"
                    rows="2"
                    class="dark:text-zinc-350 w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 font-mono text-xs text-zinc-700 outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950"
                    placeholder="https://example.com"
                  ></textarea>
                </div>

                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <!-- Frame Text Input -->
                  <div>
                    <span
                      class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-400"
                      >{{ $t('Frame text') }}</span
                    >
                    <input
                      type="text"
                      v-model="frameTextsFromCsv[previewRowIndex]"
                      @input="frameText = frameTextsFromCsv[previewRowIndex] || defaultFrameText"
                      class="dark:text-zinc-350 w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 font-mono text-xs text-zinc-700 outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950"
                      :placeholder="defaultFrameText"
                    />
                  </div>

                  <!-- File Name Input -->
                  <div>
                    <span
                      class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-400"
                      >{{ $t('File name') }}</span
                    >
                    <input
                      type="text"
                      v-model="fileNamesFromCsv[previewRowIndex]"
                      @keypress="onFilenameKeypress"
                      class="dark:text-zinc-350 w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 font-mono text-xs text-zinc-700 outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950"
                      placeholder="filename"
                    />
                  </div>
                </div>
              </div>
              <div class="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  class="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 outline-none disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                  :disabled="previewRowIndex === 0"
                  @click="previewRowIndex--"
                >
                  &larr; ก่อนหน้า
                </button>
                <button
                  type="button"
                  class="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 outline-none disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                  :disabled="previewRowIndex === dataStringsFromCsv.length - 1"
                  @click="previewRowIndex++"
                >
                  ถัดไป &rarr;
                </button>
              </div>
            </div>

            <!-- Run Batch Processing buttons -->
            <div class="space-y-2 pt-2">
              <span class="block text-xs font-bold text-zinc-500"
                >เลือกรูปแบบที่จะส่งออกชุดไฟล์ ZIP:</span
              >
              <div class="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  @click="downloadQRImage('png')"
                  :disabled="isBatchExportRunning"
                  class="flex items-center justify-center rounded-xl bg-zinc-800 py-2.5 text-xs font-bold text-white shadow-md shadow-zinc-800/10 outline-none transition-all hover:bg-zinc-900 disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                >
                  <span>ส่งออก PNG ZIP</span>
                </button>
                <button
                  type="button"
                  @click="downloadQRImage('jpg')"
                  :disabled="isBatchExportRunning"
                  class="flex items-center justify-center rounded-xl bg-zinc-800 py-2.5 text-xs font-bold text-white shadow-md shadow-zinc-800/10 outline-none transition-all hover:bg-zinc-900 disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                >
                  <span>ส่งออก JPG ZIP</span>
                </button>
                <button
                  type="button"
                  @click="downloadQRImage('svg')"
                  :disabled="isBatchExportRunning"
                  class="flex items-center justify-center rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/10 outline-none transition-all hover:bg-blue-700 disabled:opacity-50"
                >
                  <span>ส่งออก SVG ZIP</span>
                </button>
              </div>
            </div>

            <!-- Batch Progress -->
            <div
              v-if="currentExportedQrCodeIndex != null"
              class="p-4.5 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/40"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="size-2 animate-pulse rounded-full bg-[var(--primary)]"></div>
                  <p class="text-xs font-bold text-[var(--text-primary)]">
                    {{ $t('Creating QR codes... This may take a while.') }}
                  </p>
                </div>
                <span class="font-mono text-xs font-semibold text-zinc-500">
                  {{
                    Math.round(
                      ((currentExportedQrCodeIndex + 1) / dataStringsFromCsv.length) * 100
                    )
                  }}%
                </span>
              </div>
              <!-- Progress track -->
              <div class="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <!-- Progress fill -->
                <div
                  class="h-full rounded-full bg-[var(--primary)] transition-all duration-300 ease-out"
                  :style="{
                    width: `${((currentExportedQrCodeIndex + 1) / dataStringsFromCsv.length) * 100}%`
                  }"
                ></div>
              </div>
              <p class="text-[10px] text-zinc-400">
                {{
                  $t('{index} / {count} QR codes have been created.', {
                    index: currentExportedQrCodeIndex + 1,
                    count: dataStringsFromCsv.length
                  })
                }}
              </p>
            </div>
          </template>
        </div>
      </div>

        <!-- 2. STYLE TAB -->
        <div v-if="isAutomation || activeStyleTab === 'style'" class="space-y-4">
          <!-- Preset selector -->
          <div
            class="dark:border-zinc-850 flex flex-col gap-1.5 border-b border-zinc-100 pb-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="max-w-sm flex-1">
              <label
                class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-400"
                >{{ t('Preset') }}</label
              >
              <div class="flex items-center gap-1.5">
                <Combobox
                  :items="allPresetOptions"
                  v-model:value="selectedPresetKey"
                  v-model:open="isPresetSelectOpen"
                  :button-label="t('Select QR code preset')"
                  :insert-divider-at-indexes="[0, 2]"
                />
                <button
                  type="button"
                  class="grid size-9 place-items-center rounded-xl border border-zinc-200 bg-white outline-none transition-all hover:scale-[1.03] hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900"
                  @click="randomizeStyleSettings"
                  :aria-label="t('Randomize style')"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="text-zinc-500"
                  >
                    <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"></path>
                    <path d="m18 2 4 4-4 4"></path>
                    <path d="M2 6h1.9c1.2 0 2.3.6 3 1.7l1.1 1.6"></path>
                    <path d="M15.4 12.8 16.7 14.7c.8 1.1 2 1.7 3.3 1.7H22"></path>
                    <path d="m18 14 4 4-4 4"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Dots Visual Grid Selector -->
          <div class="space-y-2">
            <span class="block text-xs font-bold text-zinc-500 dark:text-zinc-400">{{
              t('Dots type')
            }}</span>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="type in [
                  'dots',
                  'rounded',
                  'classy',
                  'classy-rounded',
                  'square',
                  'extra-rounded'
                ]"
                :key="type"
                type="button"
                @click="dotsOptionsType = type"
                :class="[
                  'flex flex-col items-center justify-center rounded-xl border p-3 text-[11px] font-semibold outline-none transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]',
                  dotsOptionsType === type
                    ? 'border-[#d4af37] bg-[#d4af37]/10 text-amber-700 shadow-sm shadow-[#d4af37]/5 dark:text-[#d4af37]'
                    : 'hover:border-zinc-350 border-zinc-200 bg-white text-zinc-500 hover:text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-200'
                ]"
              >
                <div
                  class="mb-1.5 flex size-6 items-center justify-center text-zinc-700 dark:text-zinc-300"
                >
                  <div v-if="type === 'square'" class="size-3.5 bg-current"></div>
                  <div v-else-if="type === 'dots'" class="size-3.5 rounded-full bg-current"></div>
                  <div v-else-if="type === 'rounded'" class="size-3.5 rounded-sm bg-current"></div>
                  <div
                    v-else-if="type === 'extra-rounded'"
                    class="size-3.5 rounded bg-current"
                  ></div>
                  <div
                    v-else-if="type === 'classy'"
                    class="size-3.5 rounded-br-full rounded-tl-full bg-current"
                  ></div>
                  <div
                    v-else-if="type === 'classy-rounded'"
                    class="size-3.5 rounded-br-sm rounded-tl-sm bg-current"
                  ></div>
                </div>
                <span>{{ t(type) }}</span>
              </button>
            </div>
          </div>

          <!-- Color palette picker (dots and bg) -->
          <div class="space-y-3 pt-2">
            <span class="block text-xs font-bold text-zinc-500 dark:text-zinc-400"
              >จานสีและพื้นหลัง (Colors & Background)</span
            >

            <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <!-- Background color -->
              <div
                class="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50/50 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/10"
              >
                <span class="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
                  >สีพื้นหลัง (Background)</span
                >
                <div class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="include-bg"
                    v-model="includeBackground"
                    class="rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                  />
                  <input
                    type="color"
                    id="background-color"
                    :value="styleBackground === 'transparent' ? '#ffffff' : (styleBackground || '#ffffff')"
                    @input="styleBackground = ($event.target as HTMLInputElement).value"
                    :disabled="!includeBackground"
                    class="size-8 cursor-pointer rounded-lg border border-zinc-200/80 disabled:opacity-40 dark:border-zinc-800"
                  />
                </div>
              </div>

              <!-- Dots color -->
              <div
                class="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50/50 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/10"
              >
                <span class="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
                  >สีของจุด (Dots Color)</span
                >
                <input
                  type="color"
                  id="dots-color"
                  :value="dotsOptionsColor || '#000000'"
                  @input="dotsOptionsColor = ($event.target as HTMLInputElement).value"
                  class="size-8 cursor-pointer rounded-lg border border-zinc-200/80 dark:border-zinc-800"
                />
              </div>
            </div>
          </div>

          <!-- Advanced settings section (Margin, border-radius, error correction level) -->
          <div class="space-y-3.5 border-t border-zinc-100 pt-2 dark:border-zinc-800">
            <span class="block text-xs font-bold text-zinc-500 dark:text-zinc-400"
              >ตั้งค่าเพิ่มเติม (Advanced Settings)</span
            >
            <div class="grid grid-cols-2 gap-3.5">
              <div>
                <label for="margin" class="text-xs font-semibold text-zinc-500"
                  >ขอบขาวภายนอก (Margin)</label
                >
                <input
                  id="margin"
                  type="number"
                  class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3.5 py-1 text-xs text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20"
                  v-model="margin"
                  placeholder="0"
                />
              </div>
              <div>
                <label for="border-radius" class="text-xs font-semibold text-zinc-500"
                  >ความโค้งมนมุมขอบ (Border Radius)</label
                >
                <input
                  id="border-radius"
                  type="number"
                  class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3.5 py-1 text-xs text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20"
                  v-model="styleBorderRadius"
                  placeholder="8"
                />
              </div>
            </div>

            <div class="space-y-2">
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-bold text-zinc-500 dark:text-zinc-400"
                  >ระดับการกู้คืนข้อผิดพลาด (Error Correction)</span
                >
              </div>

              <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button
                  v-for="level in errorCorrectionLevels"
                  :key="level"
                  type="button"
                  @click="errorCorrectionLevel = level"
                  :class="[
                    'flex flex-col items-center justify-center rounded-xl border p-2.5 text-[11px] font-semibold outline-none transition-all',
                    errorCorrectionLevel === level
                      ? 'border-[#d4af37] bg-[#d4af37]/10 text-amber-700 shadow-sm dark:text-[#d4af37]'
                      : 'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900'
                  ]"
                >
                  <span>{{ t(ERROR_CORRECTION_LEVEL_LABELS[level]) }}</span>
                  <span
                    v-if="level === recommendedErrorCorrectionLevel"
                    class="mt-0.5 text-[9px] text-emerald-500"
                    >({{ t('Suggested') }})</span
                  >
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. EYE STYLE TAB -->
        <div v-if="isAutomation || activeStyleTab === 'eyestyle'" class="space-y-4">
          <!-- Corners Square Visual Grid Selector -->
          <div class="space-y-2">
            <span class="block text-xs font-bold text-zinc-500 dark:text-zinc-400">{{
              t('Corners Square type')
            }}</span>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                v-for="type in ['dot', 'square', 'rounded', 'extra-rounded']"
                :key="type"
                type="button"
                @click="cornersSquareOptionsType = type"
                :class="[
                  'flex flex-col items-center justify-center rounded-xl border p-3 text-[11px] font-semibold outline-none transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]',
                  cornersSquareOptionsType === type
                    ? 'border-[#d4af37] bg-[#d4af37]/10 text-amber-700 shadow-sm shadow-[#d4af37]/5 dark:text-[#d4af37]'
                    : 'hover:border-zinc-350 border-zinc-200 bg-white text-zinc-500 hover:text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-200'
                ]"
              >
                <div
                  class="mb-1 flex size-6 items-center justify-center text-zinc-700 dark:text-zinc-300"
                >
                  <div
                    v-if="type === 'square'"
                    class="size-4 rounded-none border-2 border-current"
                  ></div>
                  <div
                    v-else-if="type === 'dot'"
                    class="size-4 rounded-full border-2 border-current"
                  ></div>
                  <div
                    v-else-if="type === 'rounded'"
                    class="size-4 rounded-sm border-2 border-current"
                  ></div>
                  <div
                    v-else-if="type === 'extra-rounded'"
                    class="size-4 rounded-md border-2 border-current"
                  ></div>
                </div>
                <span>{{ t(type) }}</span>
              </button>
            </div>
          </div>

          <!-- Corners Dot Visual Grid Selector -->
          <div class="space-y-2">
            <span class="block text-xs font-bold text-zinc-500 dark:text-zinc-400">{{
              t('Corners Dot type')
            }}</span>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="type in ['dot', 'square', 'rounded']"
                :key="type"
                type="button"
                @click="cornersDotOptionsType = type"
                :class="[
                  'flex flex-col items-center justify-center rounded-xl border p-3 text-[11px] font-semibold outline-none transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]',
                  cornersDotOptionsType === type
                    ? 'border-[#d4af37] bg-[#d4af37]/10 text-amber-700 shadow-sm shadow-[#d4af37]/5 dark:text-[#d4af37]'
                    : 'hover:border-zinc-350 border-zinc-200 bg-white text-zinc-500 hover:text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-200'
                ]"
              >
                <div
                  class="mb-1 flex size-6 items-center justify-center text-zinc-700 dark:text-zinc-300"
                >
                  <div v-if="type === 'square'" class="size-3 bg-current"></div>
                  <div v-else-if="type === 'dot'" class="size-3 rounded-full bg-current"></div>
                  <div v-else-if="type === 'rounded'" class="size-3 rounded-sm bg-current"></div>
                </div>
                <span>{{ t(type) }}</span>
              </button>
            </div>
          </div>

          <!-- Eye Colors (Corner Square & Corner Dot) -->
          <div class="space-y-3 pt-2">
            <span class="block text-xs font-bold text-zinc-500 dark:text-zinc-400"
              >สีของหัวอ่าน (Corner Eyes Colors)</span
            >

            <div class="grid grid-cols-1 gap-3.5 border-b border-zinc-100 pb-4 dark:border-zinc-800 sm:grid-cols-2">
              <!-- Corner Squares color -->
              <div
                class="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50/50 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/10"
              >
                <span class="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
                  >สีมุมนอก (Corner Square)</span
                >
                <input
                  type="color"
                  id="corners-square-color"
                  :value="cornersSquareOptionsColor || '#000000'"
                  @input="cornersSquareOptionsColor = ($event.target as HTMLInputElement).value"
                  class="size-8 cursor-pointer rounded-lg border border-zinc-200/80 dark:border-zinc-800"
                />
              </div>

              <!-- Corner Dots color -->
              <div
                class="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50/50 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/10"
              >
                <span class="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
                  >สีจุดมุมใน (Corner Dot)</span
                >
                <input
                  type="color"
                  id="corners-dot-color"
                  :value="cornersDotOptionsColor || '#000000'"
                  @input="cornersDotOptionsColor = ($event.target as HTMLInputElement).value"
                  class="size-8 cursor-pointer rounded-lg border border-zinc-200/80 dark:border-zinc-800"
                />
              </div>
            </div>
          </div>

          <!-- Frame Setup -->
          <div class="dark:border-zinc-850 border-b border-zinc-100 pb-4">
            <div class="mb-3 flex items-center gap-2">
              <input id="show-frame" type="checkbox" v-model="showFrame" />
              <label for="show-frame" class="text-xs font-bold text-zinc-700 dark:text-zinc-300">{{
                t('Add frame')
              }}</label>
            </div>

            <fieldset v-if="showFrame" class="space-y-3">
              <legend class="sr-only">{{ t('Caption') }}</legend>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-400"
                    >{{ t('Frame preset') }}</label
                  >
                  <Combobox
                    :items="allFramePresetOptions"
                    v-model:value="selectedFramePresetKey"
                    :button-label="t('Select frame preset')"
                  />
                </div>
                <div>
                  <label
                    for="frame-text-top"
                    class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-400"
                    >ข้อความด้านบน (Top Text)</label
                  >
                  <input
                    id="frame-text-top"
                    type="text"
                    class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3.5 py-2 text-xs text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20"
                    v-model="frameTextTop"
                    placeholder="พิมพ์ข้อความด้านบนคิวอาร์..."
                  />
                </div>
                <div>
                  <label
                    for="frame-text-bottom"
                    class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-400"
                    >ข้อความด้านล่าง (Bottom Text)</label
                  >
                  <input
                    id="frame-text-bottom"
                    type="text"
                    class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3.5 py-2 text-xs text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20"
                    v-model="frameTextBottom"
                    placeholder="พิมพ์ข้อความด้านล่างคิวอาร์..."
                  />
                </div>
                <div>
                  <label
                    class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-400"
                    >{{ t('Font family') }}</label
                  >
                  <select
                    :value="frameStyle.fontFamily || ''"
                    @change="onFontFamilyChange(($event.target as HTMLSelectElement).value)"
                    class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3.5 py-2 text-xs text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20"
                  >
                    <option value="">Default</option>
                    <optgroup
                      v-for="group in groupedFontOptions.groups"
                      :key="group.category"
                      :label="group.label"
                    >
                      <option v-for="font in group.fonts" :key="font.value" :value="font.value">
                        {{ font.label }}
                      </option>
                    </optgroup>
                    <option
                      v-for="font in groupedFontOptions.ungrouped"
                      :key="font.value"
                      :value="font.value"
                    >
                      {{ font.label }}
                    </option>
                  </select>
                </div>
                <div v-if="!frameTextTop && !frameTextBottom">
                  <label
                    for="frame-text"
                    class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-400"
                    >{{ t('Text') }} (โหมดเดี่ยว)</label
                  >
                  <input
                    id="frame-text"
                    type="text"
                    class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3.5 py-2 text-xs text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20"
                    v-model="frameText"
                    :placeholder="defaultFrameText"
                  />
                </div>
              </div>

              <!-- Top/Bottom Custom Text Styles (Font size and color) -->
              <div v-if="frameTextTop || frameTextBottom" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <!-- Top Text customization -->
                <div v-if="frameTextTop" class="space-y-2.5 rounded-xl border border-zinc-200/60 bg-zinc-50/30 p-3.5 dark:border-zinc-800/60 dark:bg-zinc-950/10">
                  <span class="block text-[11px] font-bold uppercase tracking-wider text-zinc-500">ปรับรูปภาพข้อความด้านบน (Top Text)</span>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="mb-1 block text-[10px] text-zinc-400">ขนาดตัวอักษร: {{ frameTextTopSize }}px</label>
                      <input
                        type="range"
                        min="10"
                        max="40"
                        v-model.number="frameTextTopSize"
                        class="w-full cursor-pointer accent-blue-600"
                      />
                    </div>
                    <div>
                      <label class="mb-1 block text-[10px] text-zinc-400">สีของข้อความ</label>
                      <div class="flex items-center gap-1.5">
                        <input
                          type="color"
                          :value="frameTextTopColor || '#000000'"
                          @input="frameTextTopColor = ($event.target as HTMLInputElement).value"
                          class="size-7 cursor-pointer rounded border border-zinc-200 dark:border-zinc-800"
                        />
                        <button
                          type="button"
                          @click="frameTextTopColor = ''"
                          class="text-[9px] text-zinc-500 hover:text-zinc-700"
                        >
                          สีเริ่มต้น
                        </button>
                      </div>
                    </div>
                    <div>
                      <label class="mb-1 block text-[10px] text-zinc-400">รูปแบบฟอนต์</label>
                      <select
                        :value="frameTextTopFont || ''"
                        @change="onFontFamilyTopChange(($event.target as HTMLSelectElement).value)"
                        class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-2.5 py-1.5 text-xs text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20"
                      >
                        <option value="">Default (ตามกรอบ)</option>
                        <optgroup
                          v-for="group in groupedFontOptions.groups"
                          :key="group.category"
                          :label="group.label"
                        >
                          <option v-for="font in group.fonts" :key="font.value" :value="font.value">
                            {{ font.label }}
                          </option>
                        </optgroup>
                        <option
                          v-for="font in groupedFontOptions.ungrouped"
                          :key="font.value"
                          :value="font.value"
                        >
                          {{ font.label }}
                        </option>
                      </select>
                    </div>
                    <div>
                      <label class="mb-1 block text-[10px] text-zinc-400">สไตล์ตัวอักษร</label>
                      <div class="flex gap-1.5">
                        <button
                          type="button"
                          @click="frameTextTopWeight = frameTextTopWeight === 'bold' ? 'normal' : 'bold'"
                          :class="[
                            'flex-1 rounded-lg border py-1.5 text-xs font-bold outline-none transition-all',
                            frameTextTopWeight === 'bold'
                              ? 'border-blue-600 bg-blue-600/10 text-blue-600 dark:border-blue-500 dark:text-blue-400'
                              : 'text-zinc-650 dark:hover:bg-zinc-850 border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'
                          ]"
                        >
                          B
                        </button>
                        <button
                          type="button"
                          @click="frameTextTopItalic = frameTextTopItalic === 'italic' ? 'normal' : 'italic'"
                          :class="[
                            'flex-1 rounded-lg border py-1.5 text-xs font-semibold italic outline-none transition-all',
                            frameTextTopItalic === 'italic'
                              ? 'border-blue-600 bg-blue-600/10 text-blue-600 dark:border-blue-500 dark:text-blue-400'
                              : 'text-zinc-650 dark:hover:bg-zinc-850 border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'
                          ]"
                        >
                          I
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Bottom Text customization -->
                <div v-if="frameTextBottom" class="space-y-2.5 rounded-xl border border-zinc-200/60 bg-zinc-50/30 p-3.5 dark:border-zinc-800/60 dark:bg-zinc-950/10">
                  <span class="block text-[11px] font-bold uppercase tracking-wider text-zinc-500">ปรับรูปภาพข้อความด้านล่าง (Bottom Text)</span>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="mb-1 block text-[10px] text-zinc-400">ขนาดตัวอักษร: {{ frameTextBottomSize }}px</label>
                      <input
                        type="range"
                        min="10"
                        max="40"
                        v-model.number="frameTextBottomSize"
                        class="w-full cursor-pointer accent-blue-600"
                      />
                    </div>
                    <div>
                      <label class="mb-1 block text-[10px] text-zinc-400">สีของข้อความ</label>
                      <div class="flex items-center gap-1.5">
                        <input
                          type="color"
                          :value="frameTextBottomColor || '#000000'"
                          @input="frameTextBottomColor = ($event.target as HTMLInputElement).value"
                          class="size-7 cursor-pointer rounded border border-zinc-200 dark:border-zinc-800"
                        />
                        <button
                          type="button"
                          @click="frameTextBottomColor = ''"
                          class="text-[9px] text-zinc-500 hover:text-zinc-700"
                        >
                          สีเริ่มต้น
                        </button>
                      </div>
                    </div>
                    <div>
                      <label class="mb-1 block text-[10px] text-zinc-400">รูปแบบฟอนต์</label>
                      <select
                        :value="frameTextBottomFont || ''"
                        @change="onFontFamilyBottomChange(($event.target as HTMLSelectElement).value)"
                        class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-2.5 py-1.5 text-xs text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20"
                      >
                        <option value="">Default (ตามกรอบ)</option>
                        <optgroup
                          v-for="group in groupedFontOptions.groups"
                          :key="group.category"
                          :label="group.label"
                        >
                          <option v-for="font in group.fonts" :key="font.value" :value="font.value">
                            {{ font.label }}
                          </option>
                        </optgroup>
                        <option
                          v-for="font in groupedFontOptions.ungrouped"
                          :key="font.value"
                          :value="font.value"
                        >
                          {{ font.label }}
                        </option>
                      </select>
                    </div>
                    <div>
                      <label class="mb-1 block text-[10px] text-zinc-400">สไตล์ตัวอักษร</label>
                      <div class="flex gap-1.5">
                        <button
                          type="button"
                          @click="frameTextBottomWeight = frameTextBottomWeight === 'bold' ? 'normal' : 'bold'"
                          :class="[
                            'flex-1 rounded-lg border py-1.5 text-xs font-bold outline-none transition-all',
                            frameTextBottomWeight === 'bold'
                              ? 'border-blue-600 bg-blue-600/10 text-blue-600 dark:border-blue-500 dark:text-blue-400'
                              : 'text-zinc-650 dark:hover:bg-zinc-850 border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'
                          ]"
                        >
                          B
                        </button>
                        <button
                          type="button"
                          @click="frameTextBottomItalic = frameTextBottomItalic === 'italic' ? 'normal' : 'italic'"
                          :class="[
                            'flex-1 rounded-lg border py-1.5 text-xs font-semibold italic outline-none transition-all',
                            frameTextBottomItalic === 'italic'
                              ? 'border-blue-600 bg-blue-600/10 text-blue-600 dark:border-blue-500 dark:text-blue-400'
                              : 'text-zinc-650 dark:hover:bg-zinc-850 border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'
                          ]"
                        >
                          I
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Legacy Position Selector (Visible only if Top/Bottom texts are empty) -->
              <div v-if="!frameTextTop && !frameTextBottom" class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <fieldset class="space-y-1">
                  <legend
                    class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-400"
                    >{{ t('Position') }}</legend
                  >
                  <div class="flex gap-1">
                    <label
                      v-for="position in framePositions"
                      :key="position"
                      class="relative flex-1 cursor-pointer"
                    >
                      <input
                        type="radio"
                        :id="'frameTextPosition-' + position"
                        :value="position"
                        v-model="frameTextPosition"
                        class="peer absolute inset-0 cursor-pointer opacity-0"
                      />
                      <span
                        :class="[
                          'block rounded-lg border py-1.5 text-center text-[11px] font-bold capitalize outline-none transition-all',
                          frameTextPosition === position
                            ? 'border-blue-600 bg-blue-600/10 text-blue-600 dark:border-blue-500 dark:text-blue-400'
                            : 'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900'
                        ]"
                      >
                        {{ t(position) }}
                      </span>
                    </label>
                  </div>
                </fieldset>

                <div v-if="frameTextPosition === 'left' || frameTextPosition === 'right'">
                  <label
                    for="frame-width"
                    class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-400"
                    >{{ t('Frame width') }}</label
                  >
                  <input
                    id="frame-width"
                    type="number"
                    class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3.5 py-1.5 text-xs text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20"
                    :min="FRAME_WIDTH_MIN"
                    :max="FRAME_WIDTH_MAX"
                    v-model.number="frameWidth"
                    :aria-invalid="!isFrameWidthValid"
                    aria-describedby="frame-width-error"
                  />
                  <p
                    v-if="!isFrameWidthValid"
                    id="frame-width-error"
                    class="mt-1 text-xs font-normal text-red-600 dark:text-red-400"
                  >
                    {{
                      t('Must be between {min} and {max} px', {
                        min: FRAME_WIDTH_MIN,
                        max: FRAME_WIDTH_MAX
                      })
                    }}
                  </p>
                </div>
              </div>
            </fieldset>
          </div>

          <!-- Frame specific colors (only if showFrame is active) -->
          <div v-if="showFrame" class="space-y-3 pt-2">
            <span class="block text-xs font-bold text-zinc-500 dark:text-zinc-400"
              >สีของกรอบ (Frame Colors)</span
            >

            <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <!-- Frame Text color -->
              <div
                class="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50/50 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/10 sm:col-span-2"
              >
                <span class="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
                  >สีตัวอักษรของกรอบ (Frame Text)</span
                >
                <input
                  type="color"
                  id="frame-text-color"
                  :value="frameStyle.textColor || '#000000'"
                  @input="frameStyle.textColor = ($event.target as HTMLInputElement).value"
                  class="size-8 cursor-pointer rounded-lg border border-zinc-200/80 dark:border-zinc-800"
                />
              </div>

              <!-- Frame Background Customization -->
              <div
                class="flex flex-col gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-950/10 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <span class="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
                  >สีพื้นหลังของกรอบ (Frame Background)</span
                >
                <div class="flex items-center gap-2.5">
                  <div class="flex items-center gap-1.5 rounded-xl border border-zinc-200/50 bg-zinc-100 p-0.5 dark:border-zinc-700/50 dark:bg-zinc-800">
                    <label class="relative cursor-pointer">
                      <input
                        type="radio"
                        id="frame-background-type-color"
                        value="color"
                        v-model="frameBackgroundType"
                        class="peer absolute inset-0 cursor-pointer opacity-0"
                      />
                      <span class="inline-block rounded-lg px-3 py-1 text-xs font-bold text-zinc-500 transition-all peer-checked:bg-white peer-checked:text-zinc-900 peer-checked:shadow-sm dark:peer-checked:bg-zinc-700 dark:peer-checked:text-zinc-100">
                        {{ t('Color') }}
                      </span>
                    </label>
                    <label class="relative cursor-pointer">
                      <input
                        type="radio"
                        id="frame-background-type-image"
                        value="image"
                        v-model="frameBackgroundType"
                        class="peer absolute inset-0 cursor-pointer opacity-0"
                      />
                      <span class="inline-block rounded-lg px-3 py-1 text-xs font-bold text-zinc-500 transition-all peer-checked:bg-white peer-checked:text-zinc-900 peer-checked:shadow-sm dark:peer-checked:bg-zinc-700 dark:peer-checked:text-zinc-100">
                        {{ t('Image') }}
                      </span>
                    </label>
                  </div>
                  <input
                    v-if="frameBackgroundType === 'color'"
                    type="color"
                    id="frame-bg-color"
                    :value="frameStyle.backgroundColor === 'transparent' ? '#ffffff' : (frameStyle.backgroundColor || '#ffffff')"
                    @input="frameStyle.backgroundColor = ($event.target as HTMLInputElement).value"
                    class="size-8 cursor-pointer rounded-xl border border-zinc-200/80 dark:border-zinc-800"
                  />
                  <button
                    v-else
                    type="button"
                    id="frame-background-image-upload"
                    @click="uploadFrameBackgroundImage"
                    class="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 outline-none hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {{ frameStyle.backgroundImage ? t('เปลี่ยนรูป') || 'เปลี่ยนรูป' : t('อัปโหลดรูป') || 'อัปโหลดรูป' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. Logo settings -->
        <div v-if="isAutomation || activeStyleTab === 'logo'" class="space-y-4">
          <div class="space-y-2">
            <label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400"
              >ภาพโลโก้ตรงกลาง (Center Logo)</label
            >
            <div class="flex items-center gap-2">
              <input
                id="image-url"
                type="text"
                class="flex-1 rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3 py-1.5 text-xs text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20"
                v-model="image"
                placeholder="https://example.com/logo.png"
              />
              <button
                type="button"
                @click="uploadImage"
                class="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 outline-none hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {{ t('Upload') }}
              </button>
              <button
                type="button"
                @click="image = ''"
                class="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 outline-none hover:bg-red-50 dark:border-red-950/30"
              >
                {{ t('Remove') }}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3.5">
            <div>
              <label for="image-margin" class="text-xs font-semibold text-zinc-500"
                >ระยะห่างรอบโลโก้ (Image Margin)</label
              >
              <input
                id="image-margin"
                type="number"
                class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3.5 py-1 text-xs text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20"
                v-model="imageMargin"
                placeholder="0"
              />
            </div>

            <div>
              <label for="image-size" class="text-xs font-semibold text-zinc-500"
                >ขนาดสัดส่วนโลโก้ (Image Size)</label
              >
              <input
                id="image-size"
                type="number"
                step="0.05"
                min="0"
                max="1"
                class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3.5 py-1 text-xs text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20"
                v-model.number="imageSize"
                placeholder="0.4"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Teleport content logic at root (will mount to Right column or mobile Drawer) -->
    <Teleport to="#main-content-container" v-if="mainContentContainer != null">
      <div id="main-content" class="flex w-full flex-col items-center">
        <!-- Live preview graphic -->
        <div
          id="qr-code-container"
          :class="[
            'mb-6 grid origin-center place-items-center',
            { 'qr-pulse-entrance': isQRAnimating }
          ]"
        >
          <FitScaleBox v-if="showFrame" :max-width="FRAME_PREVIEW_MAX_WIDTH">
            <div id="element-to-export" class="w-fit">
              <QRCodeFrame
                :frame-text="frameText"
                :text-position="frameTextPosition"
                :frame-style="frameStyle"
                :caption-width="frameCaptionWidth"
                :frame-text-top="frameTextTop"
                :frame-text-bottom="frameTextBottom"
                :text-color-top="frameTextTopColor"
                :text-color-bottom="frameTextBottomColor"
                :font-size-top="frameTextTopSize"
                :font-size-bottom="frameTextBottomSize"
                :font-weight-top="frameTextTopWeight"
                :font-weight-bottom="frameTextBottomWeight"
                :font-style-top="frameTextTopItalic"
                :font-style-bottom="frameTextBottomItalic"
                :font-family-top="frameTextTopFont"
                :font-family-bottom="frameTextBottomFont"
              >
                <template #qr-code>
                  <div id="qr-code-container" class="grid place-items-center">
                    <div
                      class="grid place-items-center overflow-hidden"
                      :style="[
                        style,
                        {
                          width: `${PREVIEW_QRCODE_DIM_UNIT}px`,
                          height: `${PREVIEW_QRCODE_DIM_UNIT}px`
                        }
                      ]"
                    >
                      <StyledQRCode
                        v-bind="{
                          ...qrCodeProps,
                          width: PREVIEW_QRCODE_DIM_UNIT,
                          height: PREVIEW_QRCODE_DIM_UNIT
                        }"
                        role="img"
                        aria-label="QR code"
                      />
                    </div>
                  </div>
                </template>
              </QRCodeFrame>
            </div>
          </FitScaleBox>
          <div
            v-else
            id="element-to-export"
            class="grid place-items-center overflow-hidden"
            :style="[
              style,
              { width: `${PREVIEW_QRCODE_DIM_UNIT}px`, height: `${PREVIEW_QRCODE_DIM_UNIT}px` }
            ]"
          >
            <StyledQRCode
              v-bind="{
                ...qrCodeProps,
                data: data?.length > 0 ? data : t('Have nice day!'),
                width: PREVIEW_QRCODE_DIM_UNIT,
                height: PREVIEW_QRCODE_DIM_UNIT
              }"
              role="img"
              aria-label="QR code"
            />
          </div>
        </div>

        <!-- Data Content Preview Thumbnail -->
        <div
          v-if="data && data.trim().length > 0 && exportMode !== ExportMode.Batch"
          class="mb-4 flex w-full gap-3 rounded-xl border p-3 text-start text-xs transition-all"
          :class="decodedDataMeta.color"
        >
          <!-- Icon Frame -->
          <div class="dark:text-zinc-350 flex size-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200/40 bg-white text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <component :is="decodedDataMeta.icon" class="size-4.5" />
          </div>
          <!-- Details -->
          <div class="min-w-0 flex-1 space-y-0.5">
            <h4 class="text-zinc-850 flex items-center gap-1.5 font-bold dark:text-zinc-100">
              <span>{{ decodedDataMeta.title }}</span>
              <span class="rounded border border-zinc-200/40 bg-white/70 px-1 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80">
                {{ decodedDataMeta.type }}
              </span>
            </h4>
            <div class="space-y-0.5 text-[10px] leading-relaxed">
              <div v-for="(detail, index) in decodedDataMeta.details" :key="index" class="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                <span class="shrink-0 font-medium text-zinc-400">{{ detail.label }}:</span>
                <span class="truncate font-semibold text-zinc-700 dark:text-zinc-300" :title="detail.value">{{ detail.value }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Export Actions Grid -->
        <div class="w-full select-none space-y-3">
          <div class="grid grid-cols-2 gap-2">
            <!-- Copy button -->
            <button
              v-if="exportMode !== ExportMode.Batch"
              id="copy-qr-image-button"
              class="btn-gold-outline flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold outline-none transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
              @click="copyQRToClipboard"
              :disabled="isExportButtonDisabled"
              :title="t('Copy QR Code to clipboard')"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>{{ t('คัดลอกรูปภาพ') }}</span>
            </button>

            <!-- Export SVG -->
            <button
              id="download-qr-image-button-svg"
              class="btn-gold-gradient flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-extrabold shadow-md hover:scale-[1.02] active:scale-[0.98]"
              @click="downloadQRImage('svg')"
              :disabled="isExportButtonDisabled"
            >
              <span>{{ t('ดาวน์โหลด SVG') }}</span>
            </button>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <!-- Export PNG -->
            <button
              id="download-qr-image-button-png"
              class="btn-gold-gradient flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-extrabold shadow-md hover:scale-[1.02] active:scale-[0.98]"
              @click="downloadQRImage('png')"
              :disabled="isExportButtonDisabled"
            >
              <span>ดาวน์โหลด PNG</span>
            </button>

            <!-- Export JPG -->
            <button
              id="download-qr-image-button-jpg"
              class="btn-gold-gradient flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-extrabold shadow-md hover:scale-[1.02] active:scale-[0.98]"
              @click="downloadQRImage('jpg')"
              :disabled="isExportButtonDisabled"
            >
              <span>ดาวน์โหลด JPG</span>
            </button>
          </div>

          <!-- ASCII Text Export Option -->
          <div v-if="exportMode !== ExportMode.Batch" class="w-full">
            <button
              type="button"
              class="btn-gold-outline flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold outline-none transition-all hover:scale-[1.01]"
              @click="openTextExportModal"
              :disabled="isExportButtonDisabled"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="4 7 4 4 20 4 20 7"></polyline>
                <line x1="9" y1="20" x2="15" y2="20"></line>
                <line x1="12" y1="4" x2="12" y2="20"></line>
              </svg>
              <span>ส่งออกเป็นตัวอักษรศิลป์ (ASCII Text)</span>
            </button>
          </div>

          <!-- Raw code box showing the generated data string -->
          <div v-if="exportMode !== ExportMode.Batch" class="w-full space-y-1 pt-1.5">
            <div class="flex items-center justify-between">
              <label class="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">ข้อมูลของคิวอาร์ (QR Encoded Data)</label>
              <span v-if="showRawDataCopied" class="animate-pulse text-[10px] font-bold text-amber-600 dark:text-[#d4af37]">คัดลอกแล้ว!</span>
            </div>
            <div class="relative flex items-center">
              <input
                type="text"
                readonly
                :value="data"
                class="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 py-2.5 pl-3.5 pr-10 font-mono text-[11px] text-zinc-600 outline-none dark:border-zinc-800 dark:bg-zinc-950/20 dark:text-zinc-400"
                placeholder="ไม่มีข้อมูลเข้ารหัส"
              />
              <button
                type="button"
                @click="copyRawData"
                class="hover:text-zinc-650 absolute right-3 text-zinc-400 dark:hover:text-zinc-200"
                title="คัดลอกข้อมูลดิบ"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
          </div>

          <!-- Save/Load config file options -->
          <div
            class="flex items-center justify-center gap-4 border-t border-zinc-200/60 pt-3 dark:border-zinc-800/60"
          >
            <button
              id="save-qr-code-config-button"
              class="text-xs font-semibold text-zinc-500 outline-none hover:text-zinc-700 dark:hover:text-zinc-300"
              @click="downloadQRConfig"
            >
              {{ t('Save Config') }}
            </button>
            <span class="text-zinc-300 dark:text-zinc-800">|</span>
            <button
              id="load-qr-code-config-button"
              class="text-xs font-semibold text-zinc-500 outline-none hover:text-zinc-700 dark:hover:text-zinc-300"
              @click="loadQrConfigFromFile"
            >
              {{ t('Load Config') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Fallback modal for manual copy in Safari -->
    <CopyImageModal
      v-if="showSafariCopyImageModal"
      :is-loading="copyModalIsLoading"
      :image-src="copyModalImageSrc"
      @close="closeCopyModal"
    />
    <TextExportModal
      :open="isTextExportModalOpen"
      :matrix="asciiMatrix"
      :has-frame="showFrame"
      :filename="exportFilename"
      :is-batch="exportMode === ExportMode.Batch"
      :batch-rows="asciiBatchRows"
      :ec-level="errorCorrectionLevel"
      @close="isTextExportModalOpen = false"
    />
  </div>
</template>

<style scoped>
@keyframes blink {
  50% { opacity: 0; }
}
@keyframes pulse-slow {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(0.96); }
}
@keyframes slide-down {
  0% { transform: translateY(-3px); opacity: 0.3; }
  50% { transform: translateY(2px); opacity: 1; }
  100% { transform: translateY(-3px); opacity: 0.3; }
}
.animate-blink {
  animation: blink 1s step-end infinite;
}
.animate-pulse-slow {
  animation: pulse-slow 2.5s ease-in-out infinite;
}
.animate-slide-down {
  animation: slide-down 1.6s ease-in-out infinite;
}
</style>
