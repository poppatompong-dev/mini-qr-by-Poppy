<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import JSZip from 'jszip'
import { supabase, isSupabaseConfigured } from '@/utils/supabase'
import { isValidShareId } from '@/utils/fileShareValidation'
import { isNetworkFailure } from '@/utils/shareApi'
import { downloadBlob } from '@/utils/download'
import { generatePdfThumbnail } from '@/utils/pdfThumbnail'
import { isImageFilename } from '@/utils/imagePreview'
import { resolveStorageName } from '@/utils/shareStorageNames'
import { renderAsync as renderDocx } from 'docx-preview'
import {
  ArrowLeft,
  Download,
  FileArchive,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileAudio,
  FileVideo,
  FileCode,
  File as FileIcon,
  AlertCircle,
  Loader2,
  Layers,
  Sparkles,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink
} from 'lucide-vue-next'

const props = defineProps<{
  shareId: string
}>()

const { t } = useI18n()

interface SharedFilesLog {
  id: string
  created_at: string
  file_name: string
  file_url: string | null
  file_size: number
  files_list: string[]
  status?: string
  expires_at?: string | null
  storage_prefix?: string | null
}

// Storage objects live under `storage_prefix` (falls back to the share id for
// legacy records that predate the hardening migration).
const storagePrefix = computed(() => shareData.value?.storage_prefix || props.shareId)

const loading = ref(true)
const error = ref('')
const shareData = ref<SharedFilesLog | null>(null)

// Download tracking
const downloadingAll = ref(false)
const downloadProgress = ref(0)

// Format size helper
const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// File format metadata helper for badges/icons
const getFileTypeMeta = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  switch (ext) {
    case 'pdf':
      return {
        label: 'PDF',
        color:
          'bg-red-500/10 text-red-600 border-red-500/20 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30',
        icon: FileText
      }
    case 'doc':
    case 'docx':
      return {
        label: 'Word',
        color:
          'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30',
        icon: FileText
      }
    case 'xls':
    case 'xlsx':
    case 'csv':
      return {
        label: 'Excel',
        color:
          'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30',
        icon: FileSpreadsheet
      }
    case 'ppt':
    case 'pptx':
      return {
        label: 'PPT',
        color:
          'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30',
        icon: FileText
      }
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return {
        label: 'ZIP',
        color:
          'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30',
        icon: FileArchive
      }
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'svg':
      return {
        label: 'IMG',
        color:
          'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-500/30',
        icon: FileImage
      }
    case 'mp3':
    case 'wav':
    case 'ogg':
    case 'm4a':
      return {
        label: 'AUDIO',
        color:
          'bg-violet-500/10 text-violet-600 border-violet-500/20 dark:bg-violet-500/20 dark:text-violet-400 dark:border-violet-500/30',
        icon: FileAudio
      }
    case 'mp4':
    case 'mov':
    case 'avi':
    case 'mkv':
      return {
        label: 'VIDEO',
        color:
          'bg-cyan-500/10 text-cyan-600 border-cyan-500/20 dark:bg-cyan-500/20 dark:text-cyan-400 dark:border-cyan-500/30',
        icon: FileVideo
      }
    case 'txt':
    case 'md':
      return {
        label: 'TXT',
        color:
          'bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:bg-zinc-500/20 dark:text-zinc-400 dark:border-zinc-500/30',
        icon: FileText
      }
    case 'js':
    case 'ts':
    case 'html':
    case 'css':
    case 'json':
      return {
        label: 'CODE',
        color:
          'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30',
        icon: FileCode
      }
    default:
      return {
        label: ext.toUpperCase() || 'FILE',
        color:
          'bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:bg-zinc-500/20 dark:text-zinc-400 dark:border-zinc-500/30',
        icon: FileIcon
      }
  }
}

// Storage filename mapping
const storageMap = ref<Record<string, string>>({})
const pdfThumbnails = ref<Record<string, string>>({})
// Filenames whose thumbnail failed to render (unsupported codec, 404, dead
// object URL). They fall back to the generic file icon instead of leaving a
// broken-image glyph in the row.
const thumbnailFailed = ref<Record<string, boolean>>({})
const docxContainer = ref<HTMLElement | null>(null)
const docxLoading = ref(false)
const docxError = ref(false)

// Fetch log entry and map storage filenames
const fetchShareDetails = async () => {
  if (!isSupabaseConfigured) {
    error.value = t('Supabase credentials missing. Check your settings.')
    loading.value = false
    return
  }

  if (!isValidShareId(props.shareId)) {
    error.value =
      t('ลิงก์แชร์ไม่ถูกต้อง กรุณาตรวจสอบ QR Code หรือลิงก์อีกครั้ง') ||
      'ลิงก์แชร์ไม่ถูกต้อง กรุณาตรวจสอบ QR Code หรือลิงก์อีกครั้ง'
    loading.value = false
    return
  }

  try {
    loading.value = true
    error.value = ''

    // Row-Level Security only exposes shares that are `ready` and not yet
    // expired, so a missing row here means "not found, expired, or deleted".
    const { data, error: dbError } = await supabase
      .from('qr_files_log')
      .select('*')
      .eq('id', props.shareId)
      .maybeSingle()

    if (dbError) throw dbError

    if (!data) {
      error.value =
        t('ไม่พบลิงก์แชร์ หรือไฟล์หมดอายุ/ถูกลบไปแล้ว') ||
        'ไม่พบลิงก์แชร์ หรือไฟล์หมดอายุ/ถูกลบไปแล้ว'
      return
    }

    // Defense in depth: even if a row leaks through, never display a share that
    // is not ready or whose expiry has passed.
    const expired = !!data.expires_at && new Date(data.expires_at).getTime() <= Date.now()
    if ((data.status && data.status !== 'ready') || expired) {
      error.value =
        t('ไม่พบลิงก์แชร์ หรือไฟล์หมดอายุ/ถูกลบไปแล้ว') ||
        'ไม่พบลิงก์แชร์ หรือไฟล์หมดอายุ/ถูกลบไปแล้ว'
      return
    }

    shareData.value = data

    // Map storage filenames
    try {
      const { data: storageFiles } = await supabase.storage
        .from('qr-files')
        .list(storagePrefix.value)

      if (storageFiles) {
        const fileNamesInStorage = storageFiles.map((f: any) => f.name)
        data.files_list.forEach((filename: string, index: number) => {
          storageMap.value[filename] = resolveStorageName(filename, index, fileNamesInStorage)
        })
      }
    } catch (storageErr) {
      console.error('Failed to list files from storage:', storageErr)
    }

    // Automatically generate thumbnails for any PDFs in the share list
    data.files_list.forEach((filename: string) => {
      if (filename.toLowerCase().endsWith('.pdf')) {
        const url = getFileUrl(filename)
        generatePdfThumbnail(url)
          .then((thumbnailUrl) => {
            pdfThumbnails.value[filename] = thumbnailUrl
          })
          .catch((err) => {
            console.error(`Failed to generate thumbnail for ${filename}:`, err)
          })
      }
    })
  } catch (err: any) {
    console.error('Failed to load share metadata:', err)
    error.value = isNetworkFailure(err)
      ? t('เชื่อมต่อเซิร์ฟเวอร์ไฟล์ไม่ได้ในขณะนี้ กรุณาลองใหม่ภายหลัง หรือติดต่อผู้ดูแลเว็บไซต์')
      : err.message || t('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง')
  } finally {
    loading.value = false
  }
}

// Helper to retrieve public URL of a file
const getFileUrl = (filename: string) => {
  const storageName = storageMap.value[filename] || filename
  const { data } = supabase.storage
    .from('qr-files')
    .getPublicUrl(`${storagePrefix.value}/${storageName}`)
  return data.publicUrl
}

// Direct Download a single file
const handleDownloadSingle = async (filename: string) => {
  try {
    const storageName = storageMap.value[filename] || filename
    let data, dlError

    const res = await supabase.storage
      .from('qr-files')
      .download(`${storagePrefix.value}/${storageName}`)
    data = res.data
    dlError = res.error

    if (dlError && storageName !== filename) {
      console.log('Indexed download failed, trying original name:', filename)
      const resFallback = await supabase.storage
        .from('qr-files')
        .download(`${storagePrefix.value}/${filename}`)
      data = resFallback.data
      dlError = resFallback.error
    }

    if (dlError) throw dlError
    if (data) {
      downloadBlob(data, filename)
    }
  } catch (err: any) {
    console.error('Failed to download file:', err)
    alert(
      t('ดาวน์โหลดไฟล์ล้มเหลว กรุณาลองใหม่อีกครั้ง') || 'ดาวน์โหลดไฟล์ล้มเหลว กรุณาลองใหม่อีกครั้ง'
    )
  }
}

// Download all as ZIP
const handleDownloadAllZip = async () => {
  if (!shareData.value || !shareData.value.files_list.length) return

  try {
    downloadingAll.value = true
    downloadProgress.value = 0

    const zip = new JSZip()
    const files = shareData.value.files_list

    let index = 0
    for (const filename of files) {
      const storageName = storageMap.value[filename] || filename
      let data, dlError

      const res = await supabase.storage
        .from('qr-files')
        .download(`${storagePrefix.value}/${storageName}`)
      data = res.data
      dlError = res.error

      if (dlError && storageName !== filename) {
        console.log('Indexed zip item download failed, trying original name:', filename)
        const resFallback = await supabase.storage
          .from('qr-files')
          .download(`${storagePrefix.value}/${filename}`)
        data = resFallback.data
        dlError = resFallback.error
      }

      if (dlError) throw dlError
      if (data) {
        zip.file(filename, data)
      }

      index++
      downloadProgress.value = Math.round((index / files.length) * 100)
    }

    // Generate ZIP
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(zipBlob, shareData.value.file_name || 'archive.zip')
  } catch (err: any) {
    console.error('Failed to generate ZIP archive:', err)
    alert(
      t('สร้างไฟล์บีบอัดล้มเหลว กรุณาลองใหม่อีกครั้ง') ||
        'สร้างไฟล์บีบอัดล้มเหลว กรุณาลองใหม่อีกครั้ง'
    )
  } finally {
    downloadingAll.value = false
  }
}

const goBackHome = () => {
  window.location.href = window.location.origin + window.location.pathname
}

// Preview Modal State
const isPreviewOpen = ref(false)
const currentPreviewIndex = ref(0)
const textFileContent = ref('')
const textFileLoading = ref(false)
const textFileError = ref(false)

const currentPreviewFilename = computed(() => {
  if (!shareData.value) return ''
  return shareData.value.files_list[currentPreviewIndex.value] || ''
})

const currentPreviewUrl = computed(() => {
  if (!currentPreviewFilename.value) return ''
  return getFileUrl(currentPreviewFilename.value)
})

const currentPreviewType = computed(() => {
  const fn = currentPreviewFilename.value
  if (!fn) return 'other'
  const ext = fn.split('.').pop()?.toLowerCase() || ''
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'].includes(ext))
    return 'image'
  if (['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus', 'weba'].includes(ext))
    return 'audio'
  if (['mp4', 'webm', 'm4v', 'mov', 'avi', 'mkv', 'ogv'].includes(ext)) return 'video'
  if (['csv', 'tsv'].includes(ext)) return 'csv'
  if (['xlsx', 'xls', 'ods'].includes(ext)) return 'sheet'
  if (
    [
      'txt',
      'md',
      'json',
      'xml',
      'yml',
      'yaml',
      'ini',
      'conf',
      'log',
      'sql',
      'js',
      'ts',
      'jsx',
      'tsx',
      'vue',
      'html',
      'htm',
      'css',
      'scss',
      'py',
      'java',
      'c',
      'h',
      'cpp',
      'cs',
      'go',
      'rs',
      'php',
      'rb',
      'sh'
    ].includes(ext)
  )
    return 'text'
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  return 'other'
})

// Blob Preview State (for secure/offline loading of PDFs and Images)
const previewBlobUrl = ref('')
const previewLoading = ref(false)
const previewError = ref(false)

const loadPreviewBlob = async (filename: string) => {
  previewLoading.value = true
  previewError.value = false
  if (previewBlobUrl.value) {
    URL.revokeObjectURL(previewBlobUrl.value)
    previewBlobUrl.value = ''
  }
  try {
    const storageName = storageMap.value[filename] || filename
    const { data, error: dlError } = await supabase.storage
      .from('qr-files')
      .download(`${storagePrefix.value}/${storageName}`)

    if (dlError) throw dlError
    if (data) {
      let blobToUse = data
      // Force correct MIME type for PDF if it's application/octet-stream or has no type
      if (filename.toLowerCase().endsWith('.pdf') && data.type !== 'application/pdf') {
        blobToUse = new Blob([data], { type: 'application/pdf' })
      }
      previewBlobUrl.value = URL.createObjectURL(blobToUse)
    }
  } catch (err) {
    console.error('Failed to load preview blob:', err)
    previewError.value = true
  } finally {
    previewLoading.value = false
  }
}

const loadTextContent = async (url: string) => {
  textFileLoading.value = true
  textFileError.value = false
  textFileContent.value = ''
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error()
    textFileContent.value = await res.text()
  } catch {
    textFileError.value = true
  } finally {
    textFileLoading.value = false
  }
}

// Table preview state — CSV/TSV and spreadsheets render as a real table so the
// recipient can read the data before deciding to download.
const MAX_TABLE_ROWS = 300
const MAX_TABLE_COLS = 30
const tableRows = ref<string[][]>([])
const tableLoading = ref(false)
const tableError = ref(false)
const tableTruncated = ref(false)
const sheetNames = ref<string[]>([])

// Audio/video the browser cannot decode fall back to a download prompt.
const mediaError = ref(false)

// Minimal RFC4180-ish parser: handles quoted fields, escaped quotes and CRLF.
const parseDelimited = (content: string, delimiter: string): string[][] => {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch !== '\r') {
      field += ch
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

const applyTableRows = (rows: string[][]) => {
  tableTruncated.value = rows.length > MAX_TABLE_ROWS || rows.some((r) => r.length > MAX_TABLE_COLS)
  tableRows.value = rows
    .slice(0, MAX_TABLE_ROWS)
    .map((r) => r.slice(0, MAX_TABLE_COLS).map((cell) => String(cell ?? '')))
}

const loadCsvTable = async (url: string, delimiter: string) => {
  tableLoading.value = true
  tableError.value = false
  tableRows.value = []
  sheetNames.value = []
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error()
    applyTableRows(parseDelimited(await res.text(), delimiter))
  } catch {
    tableError.value = true
  } finally {
    tableLoading.value = false
  }
}

const loadSheetTable = async (filename: string) => {
  tableLoading.value = true
  tableError.value = false
  tableRows.value = []
  sheetNames.value = []
  try {
    const storageName = storageMap.value[filename] || filename
    const { data, error: dlError } = await supabase.storage
      .from('qr-files')
      .download(`${storagePrefix.value}/${storageName}`)
    if (dlError || !data) throw dlError
    // SheetJS is heavy, so it is only fetched when a spreadsheet is previewed.
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(await data.arrayBuffer(), { type: 'array' })
    sheetNames.value = workbook.SheetNames
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<string[]>(firstSheet, {
      header: 1,
      raw: false,
      defval: ''
    })
    applyTableRows(rows)
  } catch (err) {
    console.error('Failed to render spreadsheet preview:', err)
    tableError.value = true
  } finally {
    tableLoading.value = false
  }
}

const renderDocxFile = async () => {
  if (!previewBlobUrl.value || !docxContainer.value) return
  docxLoading.value = true
  docxError.value = false
  try {
    const res = await fetch(previewBlobUrl.value)
    const blob = await res.blob()

    // Clear container
    docxContainer.value.innerHTML = ''

    // Render Docx
    await renderDocx(blob, docxContainer.value, undefined, {
      className: 'docx-preview-container',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false
    })
  } catch (err) {
    console.error('Failed to render docx file:', err)
    docxError.value = true
  } finally {
    docxLoading.value = false
  }
}

watch([currentPreviewIndex, isPreviewOpen], async () => {
  if (isPreviewOpen.value) {
    mediaError.value = false
    const type = currentPreviewType.value
    if (type === 'text' && currentPreviewUrl.value) {
      await loadTextContent(currentPreviewUrl.value)
    } else if (type === 'csv' && currentPreviewUrl.value) {
      const delimiter = currentPreviewFilename.value.toLowerCase().endsWith('.tsv') ? '\t' : ','
      await loadCsvTable(currentPreviewUrl.value, delimiter)
    } else if (type === 'sheet') {
      await loadSheetTable(currentPreviewFilename.value)
    } else if (type === 'image' || type === 'pdf' || type === 'docx') {
      await loadPreviewBlob(currentPreviewFilename.value)
    }
  }
})

watch([previewBlobUrl, currentPreviewType], async () => {
  if (isPreviewOpen.value && currentPreviewType.value === 'docx' && previewBlobUrl.value) {
    await nextTick()
    await renderDocxFile()
  }
})

const openPreview = (filename: string) => {
  if (!shareData.value) return
  const index = shareData.value.files_list.indexOf(filename)
  if (index !== -1) {
    currentPreviewIndex.value = index
    isPreviewOpen.value = true
  }
}

const nextPreview = () => {
  if (!shareData.value) return
  if (currentPreviewIndex.value < shareData.value.files_list.length - 1) {
    currentPreviewIndex.value++
  } else {
    currentPreviewIndex.value = 0
  }
}

const prevPreview = () => {
  if (!shareData.value) return
  if (currentPreviewIndex.value > 0) {
    currentPreviewIndex.value--
  } else {
    currentPreviewIndex.value = shareData.value.files_list.length - 1
  }
}

const closePreview = () => {
  isPreviewOpen.value = false
  if (previewBlobUrl.value) {
    URL.revokeObjectURL(previewBlobUrl.value)
    previewBlobUrl.value = ''
  }
}

// The preview is a full-screen overlay, so Escape has to close it and the arrow
// keys should walk the same way the Back/Next buttons do — without them the
// overlay traps the reader on whichever file they opened.
const handlePreviewKeys = (event: KeyboardEvent) => {
  if (!isPreviewOpen.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    closePreview()
  } else if (event.key === 'ArrowRight') {
    nextPreview()
  } else if (event.key === 'ArrowLeft') {
    prevPreview()
  }
}

onMounted(() => {
  fetchShareDetails()
  window.addEventListener('keydown', handlePreviewKeys)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handlePreviewKeys)
})
</script>

<template>
  <div class="mx-auto w-full max-w-2xl px-0 py-6 text-start md:px-4 md:py-8">
    <!-- Title Area -->
    <div class="mb-6 flex flex-col gap-2">
      <h2 class="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-2xl">
        {{ t('ดาวน์โหลดไฟล์ที่แชร์') || 'ดาวน์โหลดไฟล์ที่แชร์' }}
      </h2>
      <p class="text-xs text-zinc-500 dark:text-zinc-400">
        {{
          t(
            'คุณสามารถเลือกดาวน์โหลดแต่ละไฟล์ได้โดยตรง หรือบีบอัดเป็นไฟล์ ZIP เพื่อดาวน์โหลดทั้งหมด'
          ) ||
          'คุณสามารถเลือกดาวน์โหลดแต่ละไฟล์ได้โดยตรง หรือบีบอัดเป็นไฟล์ ZIP เพื่อดาวน์โหลดทั้งหมด'
        }}
      </p>
    </div>

    <!-- Loading State -->
    <div
      v-if="loading"
      class="glass-card flex flex-col items-center justify-center p-12 text-center"
    >
      <div class="relative flex size-16 items-center justify-center">
        <div
          class="absolute inset-0 animate-ping rounded-full bg-blue-500/10 dark:bg-blue-400/10"
        ></div>
        <div
          class="relative flex size-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
        >
          <Loader2 class="size-6 animate-spin" />
        </div>
      </div>
      <h4 class="mt-4 text-sm font-bold text-zinc-800 dark:text-zinc-200">
        {{ t('กำลังโหลดข้อมูลไฟล์ที่แชร์...') || 'กำลังโหลดข้อมูลไฟล์ที่แชร์...' }}
      </h4>
    </div>

    <!-- Error State -->
    <div
      v-else-if="error"
      class="glass-card border-red-200 bg-red-50/20 p-8 text-center dark:border-red-900/40 dark:bg-red-950/10"
    >
      <div
        class="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400"
      >
        <AlertCircle class="size-6" />
      </div>
      <h3 class="text-base font-bold text-zinc-800 dark:text-zinc-200">
        {{ t('เกิดข้อผิดพลาด') || 'เกิดข้อผิดพลาด' }}
      </h3>
      <p class="text-zinc-550 mt-2 text-xs leading-relaxed dark:text-zinc-400">
        {{ error }}
      </p>
      <button
        @click="goBackHome"
        class="dark:hover:bg-zinc-750 mt-6 inline-flex items-center gap-2 rounded-xl bg-zinc-200 px-5 py-2.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300"
      >
        <ArrowLeft class="size-4" />
        <span>{{ t('กลับหน้าหลัก') || 'กลับหน้าหลัก' }}</span>
      </button>
    </div>

    <!-- Content State -->
    <div v-else-if="shareData" class="space-y-6">
      <!-- Main Card -->
      <div class="glass-card space-y-6 p-3 sm:p-5 md:p-6">
        <!-- Archive Summary Info -->
        <div
          class="flex flex-col gap-3 rounded-2xl border border-zinc-200/60 bg-zinc-50/40 p-3 dark:border-zinc-800/60 dark:bg-zinc-900/10 md:p-4"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <span
                class="text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
              >
                {{ t('ชื่อชุดข้อมูลไฟล์') || 'ชื่อชุดข้อมูลไฟล์' }}
              </span>
              <h3 class="truncate text-sm font-bold text-zinc-800 dark:text-zinc-200">
                {{ shareData.file_name || 'archive.zip' }}
              </h3>
            </div>
            <span
              class="inline-flex items-center gap-1 rounded-full border border-blue-100/50 bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-600 dark:border-blue-900/30 dark:bg-blue-950/30 dark:text-blue-400"
            >
              <Layers class="size-3" />
              <span>{{ shareData.files_list.length }} {{ t('ไฟล์') || 'ไฟล์' }}</span>
            </span>
          </div>

          <div
            class="flex items-center justify-between border-t border-zinc-200/40 pt-3 text-[11px] text-zinc-500 dark:border-zinc-800/40 dark:text-zinc-400"
          >
            <span>{{ t('ขนาดไฟล์รวมทั้งหมด') || 'ขนาดไฟล์รวมทั้งหมด' }}</span>
            <span class="text-zinc-850 font-mono font-bold dark:text-zinc-200">
              {{ formatSize(shareData.file_size) }}
            </span>
          </div>
        </div>

        <!-- Files List -->
        <div class="space-y-3">
          <h4 class="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            {{ t('รายการไฟล์ทั้งหมด') || 'รายการไฟล์ทั้งหมด' }}
          </h4>

          <div class="max-h-[300px] space-y-2.5 overflow-y-auto pr-1">
            <div
              v-for="filename in shareData.files_list"
              :key="filename"
              @click="openPreview(filename)"
              class="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-zinc-200/60 bg-white p-2 transition-all duration-300 hover:scale-[1.005] hover:border-blue-300 hover:bg-blue-50/5 hover:shadow-md dark:border-zinc-800/60 dark:bg-zinc-900/20 dark:hover:border-blue-800/60 dark:hover:bg-zinc-900/40 sm:p-3 md:p-3.5"
            >
              <!-- Left: Icon & Name -->
              <div class="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                <div
                  class="dark:border-zinc-850 flex size-8 shrink-0 select-none items-center justify-center overflow-hidden rounded-xl border border-zinc-200/60 bg-zinc-50/50 dark:bg-zinc-950 sm:size-9"
                >
                  <img
                    v-if="
                      isImageFilename(filename) &&
                      !thumbnailFailed[filename] &&
                      getFileUrl(filename)
                    "
                    :src="getFileUrl(filename)"
                    class="size-full object-cover"
                    alt="thumbnail"
                    @error="thumbnailFailed[filename] = true"
                  />
                  <img
                    v-else-if="filename.toLowerCase().endsWith('.pdf') && pdfThumbnails[filename]"
                    :src="pdfThumbnails[filename]"
                    class="size-full object-cover"
                    alt="PDF thumbnail"
                  />
                  <!-- Beautiful mock document thumbnail for non-image files -->
                  <div
                    v-else
                    :class="`flex size-full flex-col items-center justify-center font-mono leading-none ${getFileTypeMeta(filename).color}`"
                  >
                    <component
                      :is="getFileTypeMeta(filename).icon"
                      class="mb-0.5 size-3.5 opacity-90"
                    />
                    <span class="text-[7px] font-bold uppercase tracking-tight">{{
                      getFileTypeMeta(filename).label
                    }}</span>
                  </div>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-bold text-zinc-800 dark:text-zinc-100">
                    {{ filename }}
                  </p>
                  <div class="mt-0.5 flex items-center gap-2">
                    <span
                      class="py-0.2 rounded border px-1.5 text-[8px] font-bold uppercase tracking-wider"
                      :class="getFileTypeMeta(filename).color"
                    >
                      {{ getFileTypeMeta(filename).label }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Right: Actions (View & Download) -->
              <div class="flex shrink-0 items-center gap-1.5 sm:gap-2">
                <button
                  @click.stop="openPreview(filename)"
                  class="text-zinc-650 dark:hover:text-blue-450 flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50/50 p-2 text-xs font-bold transition-all hover:border-blue-200 hover:bg-blue-50/40 hover:text-blue-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-blue-900/50 dark:hover:bg-blue-950/40 sm:px-3 sm:py-2"
                  :title="t('ดูตัวอย่างไฟล์') || 'ดูตัวอย่างไฟล์'"
                >
                  <Eye class="size-3.5" />
                  <span class="hidden sm:inline">{{ t('ดูตัวอย่าง') || 'ดูตัวอย่าง' }}</span>
                </button>
                <button
                  @click.stop="handleDownloadSingle(filename)"
                  class="text-zinc-650 dark:hover:text-emerald-450 flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50/50 p-2 text-xs font-bold transition-all hover:border-emerald-200 hover:bg-emerald-50/40 hover:text-emerald-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-emerald-900/50 dark:hover:bg-emerald-950/40 sm:px-3 sm:py-2"
                  :title="t('ดาวน์โหลดไฟล์') || 'ดาวน์โหลดไฟล์'"
                >
                  <Download class="size-3.5" />
                  <span class="hidden sm:inline">{{ t('ดาวน์โหลด') || 'ดาวน์โหลด' }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Download All ZIP Button -->
        <div class="border-t border-zinc-200/60 pt-5 dark:border-zinc-800/60">
          <!-- ZIP Download State -->
          <div v-if="downloadingAll" class="space-y-2">
            <div
              class="text-zinc-650 dark:text-zinc-350 flex items-center justify-between text-xs font-bold"
            >
              <span class="flex items-center gap-1.5">
                <Loader2 class="size-3.5 animate-spin text-blue-600 dark:text-blue-400" />
                <span>{{
                  t('กำลังดาวน์โหลดไฟล์และบีบอัดเป็น ZIP...') ||
                  'กำลังดาวน์โหลดไฟล์และบีบอัดเป็น ZIP...'
                }}</span>
              </span>
              <span class="font-mono text-blue-600 dark:text-blue-400"
                >{{ downloadProgress }}%</span
              >
            </div>
            <div
              class="h-2 w-full overflow-hidden rounded-full border border-zinc-200/20 bg-zinc-100 dark:bg-zinc-800"
            >
              <div
                class="h-full bg-blue-600 transition-all duration-300 dark:bg-blue-500"
                :style="{ width: `${downloadProgress}%` }"
              ></div>
            </div>
          </div>

          <button
            v-else
            @click="handleDownloadAllZip"
            class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white shadow-md shadow-blue-500/10 transition hover:bg-blue-700 active:scale-[0.99] sm:text-sm"
          >
            <FileArchive class="size-4.5" />
            <span>{{ t('ดาวน์โหลดไฟล์ทั้งหมด (ZIP)') || 'ดาวน์โหลดไฟล์ทั้งหมด (ZIP)' }}</span>
          </button>
        </div>
      </div>

      <!-- Footer Action Back -->
      <div class="flex justify-center">
        <button
          @click="goBackHome"
          class="text-zinc-650 dark:text-zinc-350 flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-xs font-bold transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          <Sparkles class="size-4 text-blue-600 dark:text-blue-400" />
          <span>{{ t('สร้าง QR Code ของคุณเอง') || 'สร้าง QR Code ของคุณเอง' }}</span>
        </button>
      </div>
    </div>

    <!-- Preview Modal -->
    <Transition name="slide-up">
      <div
        v-if="isPreviewOpen && shareData"
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      >
        <div
          class="glass-card flex h-[85vh] w-full flex-col rounded-t-3xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900/95 sm:h-[80vh] sm:max-w-3xl sm:rounded-2xl md:p-6"
        >
          <!-- Modal Header -->
          <div
            class="flex items-center justify-between border-b border-zinc-200 pb-3.5 dark:border-zinc-800"
          >
            <div class="min-w-0 flex-1">
              <span
                class="text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
              >
                {{ t('พรีวิวไฟล์ (File Preview)') || 'พรีวิวไฟล์ (File Preview)' }} —
                {{ currentPreviewIndex + 1 }} / {{ shareData.files_list.length }}
              </span>
              <h3 class="truncate text-sm font-bold text-zinc-800 dark:text-zinc-200">
                {{ currentPreviewFilename }}
              </h3>
            </div>
            <button
              @click="closePreview"
              class="rounded-lg border border-zinc-200 p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <X class="size-4" />
            </button>
          </div>

          <!-- Modal Content Preview Area -->
          <div
            class="border-zinc-150/40 my-4 flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-xl border bg-zinc-50/50 py-5 dark:border-zinc-800/40 dark:bg-zinc-950/20"
          >
            <!-- Image Preview -->
            <div
              v-if="currentPreviewType === 'image'"
              class="flex max-h-full max-w-full items-center justify-center p-2"
            >
              <div v-if="previewLoading" class="flex flex-col items-center justify-center py-20">
                <Loader2 class="size-8 animate-spin text-blue-600 dark:text-blue-400" />
                <p class="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                  {{ t('กำลังโหลดรูปภาพ...') || 'กำลังโหลดรูปภาพ...' }}
                </p>
              </div>
              <div
                v-else-if="previewError"
                class="flex flex-col items-center justify-center py-10 text-center text-red-500"
              >
                <AlertCircle class="mb-2 size-8" />
                <p class="text-xs font-bold">
                  {{ t('ไม่สามารถโหลดรูปภาพนี้ได้') || 'ไม่สามารถโหลดรูปภาพนี้ได้' }}
                </p>
              </div>
              <img
                v-else
                :src="previewBlobUrl"
                :alt="currentPreviewFilename"
                class="max-h-[50vh] max-w-full rounded-lg object-contain shadow-md"
                @error="previewError = true"
              />
            </div>

            <!-- Audio Preview -->
            <div v-else-if="currentPreviewType === 'audio'" class="w-full max-w-md p-6 text-center">
              <div
                class="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400"
              >
                <FileAudio class="size-7" />
              </div>
              <div v-if="mediaError" class="space-y-3">
                <p class="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  {{ t('เบราว์เซอร์นี้เล่นไฟล์เสียงชนิดนี้ไม่ได้ กรุณาดาวน์โหลดเพื่อเปิดฟัง') }}
                </p>
                <button
                  @click="handleDownloadSingle(currentPreviewFilename)"
                  class="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-zinc-700 active:scale-95 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                >
                  <Download class="size-3.5" />
                  <span>{{ t('ดาวน์โหลดไฟล์') || 'ดาวน์โหลดไฟล์' }}</span>
                </button>
              </div>
              <audio
                v-else
                controls
                class="w-full"
                :src="currentPreviewUrl"
                @error="mediaError = true"
              ></audio>
            </div>

            <!-- Video Preview -->
            <div
              v-else-if="currentPreviewType === 'video'"
              class="flex max-h-full max-w-full items-center justify-center p-2"
            >
              <div v-if="mediaError" class="w-full max-w-sm p-6 text-center">
                <div
                  class="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400"
                >
                  <FileVideo class="size-7" />
                </div>
                <p class="mb-3 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  {{ t('เบราว์เซอร์นี้เล่นวิดีโอชนิดนี้ไม่ได้ กรุณาดาวน์โหลดเพื่อเปิดชม') }}
                </p>
                <button
                  @click="handleDownloadSingle(currentPreviewFilename)"
                  class="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-zinc-700 active:scale-95 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                >
                  <Download class="size-3.5" />
                  <span>{{ t('ดาวน์โหลดไฟล์') || 'ดาวน์โหลดไฟล์' }}</span>
                </button>
              </div>
              <video
                v-else
                controls
                class="max-h-[50vh] max-w-full rounded-lg shadow-md"
                :src="currentPreviewUrl"
                @error="mediaError = true"
              ></video>
            </div>

            <!-- Text Preview -->
            <div v-else-if="currentPreviewType === 'text'" class="size-full overflow-auto p-4">
              <div
                v-if="textFileLoading"
                class="flex h-full flex-col items-center justify-center py-10"
              >
                <Loader2 class="size-6 animate-spin text-blue-600 dark:text-blue-400" />
                <p class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {{ t('กำลังโหลดข้อมูล...') }}
                </p>
              </div>
              <div
                v-else-if="textFileError"
                class="flex h-full flex-col items-center justify-center text-center text-red-500"
              >
                <AlertCircle class="mb-2 size-6" />
                <p class="text-xs font-bold">{{ t('ไม่สามารถพรีวิวไฟล์ข้อความนี้ได้') }}</p>
              </div>
              <pre
                v-else
                class="h-full max-h-[50vh] select-text overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-3.5 text-left font-mono text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                >{{ textFileContent }}</pre
              >
            </div>

            <!-- PDF Preview -->
            <div
              v-else-if="currentPreviewType === 'pdf'"
              class="flex size-full flex-col items-center justify-center p-2"
            >
              <div v-if="previewLoading" class="flex flex-col items-center justify-center py-20">
                <Loader2 class="size-8 animate-spin text-blue-600 dark:text-blue-400" />
                <p class="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                  {{ t('กำลังโหลดเอกสาร PDF...') || 'กำลังโหลดเอกสาร PDF...' }}
                </p>
              </div>
              <div
                v-else-if="previewError"
                class="flex flex-col items-center justify-center py-10 text-center text-red-500"
              >
                <AlertCircle class="mb-2 size-8" />
                <p class="text-xs font-bold">
                  {{ t('ไม่สามารถโหลดเอกสาร PDF นี้ได้') || 'ไม่สามารถโหลดเอกสาร PDF นี้ได้' }}
                </p>
              </div>
              <iframe
                v-else
                :src="previewBlobUrl"
                class="h-[50vh] w-full rounded-lg border border-zinc-200 dark:border-zinc-800"
              ></iframe>
            </div>

            <!-- Docx Preview -->
            <div
              v-else-if="currentPreviewType === 'docx'"
              class="flex size-full flex-col items-center overflow-auto p-4"
            >
              <div
                v-if="previewLoading || docxLoading"
                class="flex flex-col items-center justify-center py-20"
              >
                <Loader2 class="size-8 animate-spin text-blue-600 dark:text-blue-400" />
                <p class="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                  {{ t('กำลังโหลดเอกสาร Word...') || 'กำลังโหลดเอกสาร Word...' }}
                </p>
              </div>
              <div
                v-else-if="previewError || docxError"
                class="flex flex-col items-center justify-center py-10 text-center text-red-500"
              >
                <AlertCircle class="mb-2 size-8" />
                <p class="text-xs font-bold">
                  {{
                    t('ไม่สามารถแสดงตัวอย่างเอกสาร Word นี้ได้') ||
                    'ไม่สามารถแสดงตัวอย่างเอกสาร Word นี้ได้'
                  }}
                </p>
              </div>
              <div
                v-show="!previewLoading && !docxLoading && !previewError && !docxError"
                ref="docxContainer"
                class="w-full max-w-2xl overflow-auto rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              ></div>
            </div>

            <!-- Table Preview (CSV / TSV / Excel) -->
            <div
              v-else-if="currentPreviewType === 'csv' || currentPreviewType === 'sheet'"
              class="size-full overflow-auto p-4"
            >
              <div
                v-if="tableLoading"
                class="flex h-full flex-col items-center justify-center py-10"
              >
                <Loader2 class="size-6 animate-spin text-blue-600 dark:text-blue-400" />
                <p class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {{ t('กำลังโหลดข้อมูลตาราง...') }}
                </p>
              </div>
              <div
                v-else-if="tableError"
                class="flex h-full flex-col items-center justify-center text-center"
              >
                <AlertCircle class="mb-2 size-6 text-red-500" />
                <p class="mb-3 text-xs font-bold text-red-500">
                  {{ t('ไม่สามารถแสดงตัวอย่างตารางนี้ได้') }}
                </p>
                <button
                  @click="handleDownloadSingle(currentPreviewFilename)"
                  class="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-zinc-700 active:scale-95 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                >
                  <Download class="size-3.5" />
                  <span>{{ t('ดาวน์โหลดไฟล์') || 'ดาวน์โหลดไฟล์' }}</span>
                </button>
              </div>
              <div
                v-else-if="tableRows.length === 0"
                class="flex h-full flex-col items-center justify-center text-center"
              >
                <FileSpreadsheet class="mb-2 size-6 text-zinc-400" />
                <p class="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                  {{ t('ไฟล์นี้ไม่มีข้อมูลตารางให้แสดง') }}
                </p>
              </div>
              <div v-else class="space-y-2">
                <div
                  class="max-h-[50vh] overflow-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <table class="w-full border-collapse text-left text-[11px]">
                    <tbody>
                      <tr
                        v-for="(row, rowIndex) in tableRows"
                        :key="rowIndex"
                        :class="
                          rowIndex === 0
                            ? 'bg-zinc-100 font-bold dark:bg-zinc-800'
                            : rowIndex % 2 === 1
                              ? 'bg-zinc-50/60 dark:bg-zinc-950/30'
                              : ''
                        "
                      >
                        <td
                          v-for="(cell, cellIndex) in row"
                          :key="cellIndex"
                          class="max-w-[240px] truncate border border-zinc-200 px-2 py-1 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
                          :title="cell"
                        >
                          {{ cell }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p
                  v-if="sheetNames.length > 1"
                  class="text-center text-[10px] text-zinc-400 dark:text-zinc-500"
                >
                  {{ t('แสดงชีตแรก') }} "{{ sheetNames[0] }}" {{ t('จากทั้งหมด') }}
                  {{ sheetNames.length }} {{ t('ชีต — ดาวน์โหลดไฟล์เพื่อดูครบทุกชีต') }}
                </p>
                <p
                  v-if="tableTruncated"
                  class="text-center text-[10px] text-zinc-400 dark:text-zinc-500"
                >
                  {{ t('แสดงข้อมูลบางส่วน — ดาวน์โหลดไฟล์เพื่อดูข้อมูลทั้งหมด') }}
                </p>
              </div>
            </div>

            <!-- Other Files Preview -->
            <div v-else class="w-full max-w-sm p-6 text-center">
              <div
                :class="`mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl border ${getFileTypeMeta(currentPreviewFilename).color}`"
              >
                <component :is="getFileTypeMeta(currentPreviewFilename).icon" class="size-8" />
              </div>
              <h4 class="mb-2 text-sm font-bold text-zinc-800 dark:text-zinc-200">
                {{ currentPreviewFilename }}
              </h4>
              <p class="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
                {{
                  t('ไฟล์ประเภทนี้ยังไม่รองรับการแสดงตัวอย่างในเบราว์เซอร์') ||
                  'ไฟล์ประเภทนี้ยังไม่รองรับการแสดงตัวอย่างในเบราว์เซอร์'
                }}
              </p>
              <button
                @click="handleDownloadSingle(currentPreviewFilename)"
                class="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-zinc-700 active:scale-95 dark:bg-zinc-700 dark:hover:bg-zinc-600"
              >
                <Download class="size-3.5" />
                <span>{{ t('ดาวน์โหลดไฟล์') || 'ดาวน์โหลดไฟล์' }}</span>
              </button>
            </div>
          </div>

          <!-- Navigation & Actions Footer -->
          <div
            class="flex flex-col items-center justify-between gap-4 border-t border-zinc-200 pt-3.5 dark:border-zinc-800 sm:flex-row"
          >
            <!-- Left: Previous / Next buttons -->
            <div class="flex w-full items-center justify-center gap-2 sm:w-auto">
              <button
                @click="prevPreview"
                class="dark:hover:bg-zinc-850 flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 transition-all hover:bg-zinc-50 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              >
                <ChevronLeft class="size-4" />
                <span>{{ t('ย้อนกลับ') || 'ย้อนกลับ' }}</span>
              </button>
              <button
                @click="nextPreview"
                class="dark:hover:bg-zinc-850 flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 transition-all hover:bg-zinc-50 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              >
                <span>{{ t('ถัดไป') || 'ถัดไป' }}</span>
                <ChevronRight class="size-4" />
              </button>
            </div>

            <!-- Right: Action Buttons -->
            <div class="flex w-full items-center justify-center gap-2 sm:w-auto">
              <a
                v-if="currentPreviewType !== 'other'"
                :href="currentPreviewUrl"
                target="_blank"
                class="dark:hover:bg-zinc-850 flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 transition-all hover:bg-zinc-50 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              >
                <ExternalLink class="size-4" />
                <span>{{ t('เปิดในแท็บใหม่') || 'เปิดในแท็บใหม่' }}</span>
              </a>
              <button
                @click="handleDownloadSingle(currentPreviewFilename)"
                class="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-blue-700 active:scale-95"
              >
                <Download class="size-4" />
                <span>{{ t('ดาวน์โหลด') || 'ดาวน์โหลด' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
:deep(.docx-preview-container) {
  background: transparent !important;
  padding: 0 !important;
}
:deep(.docx-preview-container > section.docx) {
  margin-bottom: 2rem !important;
  box-shadow:
    0 4px 6px -1px rgb(0 0 0 / 0.1),
    0 2px 4px -2px rgb(0 0 0 / 0.1) !important;
  border: 1px solid #e4e4e7 !important;
  border-radius: 8px !important;
  background-color: #ffffff !important;
  color: #18181b !important;
  padding: 2rem !important;
}
.dark :deep(.docx-preview-container > section.docx) {
  border-color: #27272a !important;
}

/* slide-up bottom sheet transition */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: opacity 0.25s ease;
}
.slide-up-enter-active .glass-card,
.slide-up-leave-active .glass-card {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
}
.slide-up-enter-from .glass-card,
.slide-up-leave-to .glass-card {
  transform: translateY(100%);
}
</style>
