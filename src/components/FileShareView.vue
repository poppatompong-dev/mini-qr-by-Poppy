<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import JSZip from 'jszip'
import { supabase, isSupabaseConfigured } from '@/utils/supabase'
import { downloadBlob } from '@/utils/download'
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
  CheckCircle,
  Layers,
  Sparkles
} from 'lucide-vue-next'

const props = defineProps<{
  shareId: string
}>()

const { t } = useI18n()

interface SharedFilesLog {
  id: string
  created_at: string
  file_name: string
  file_url: string
  file_size: number
  files_list: string[]
}

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
      return { label: 'PDF', color: 'bg-red-500/10 text-red-600 border-red-500/20 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30', icon: FileText }
    case 'doc':
    case 'docx':
      return { label: 'Word', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30', icon: FileText }
    case 'xls':
    case 'xlsx':
    case 'csv':
      return { label: 'Excel', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30', icon: FileSpreadsheet }
    case 'ppt':
    case 'pptx':
      return { label: 'PPT', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30', icon: FileText }
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return { label: 'ZIP', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30', icon: FileArchive }
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'svg':
      return { label: 'IMG', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-500/30', icon: FileImage }
    case 'mp3':
    case 'wav':
    case 'ogg':
    case 'm4a':
      return { label: 'AUDIO', color: 'bg-violet-500/10 text-violet-600 border-violet-500/20 dark:bg-violet-500/20 dark:text-violet-400 dark:border-violet-500/30', icon: FileAudio }
    case 'mp4':
    case 'mov':
    case 'avi':
    case 'mkv':
      return { label: 'VIDEO', color: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20 dark:bg-cyan-500/20 dark:text-cyan-400 dark:border-cyan-500/30', icon: FileVideo }
    case 'txt':
    case 'md':
      return { label: 'TXT', color: 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:bg-zinc-500/20 dark:text-zinc-400 dark:border-zinc-500/30', icon: FileText }
    case 'js':
    case 'ts':
    case 'html':
    case 'css':
    case 'json':
      return { label: 'CODE', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30', icon: FileCode }
    default:
      return { label: ext.toUpperCase() || 'FILE', color: 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:bg-zinc-500/20 dark:text-zinc-400 dark:border-zinc-500/30', icon: FileIcon }
  }
}

// Fetch log entry
const fetchShareDetails = async () => {
  if (!isSupabaseConfigured) {
    error.value = t('Supabase credentials missing. Check your settings.')
    loading.value = false
    return
  }

  try {
    loading.value = true
    error.value = ''
    
    const { data, error: dbError } = await supabase
      .from('qr_files_log')
      .select('*')
      .eq('id', props.shareId)
      .maybeSingle()

    if (dbError) throw dbError
    
    if (!data) {
      error.value = t('ไม่พบลิงก์แชร์ข้อมูล หรือไฟล์อาจจะถูกลบไปแล้ว') || 'ไม่พบลิงก์แชร์ข้อมูล หรือไฟล์อาจจะถูกลบไปแล้ว'
      return
    }

    shareData.value = data
  } catch (err: any) {
    console.error('Failed to load share metadata:', err)
    error.value = err.message || t('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง')
  } finally {
    loading.value = false
  }
}

// Direct Download a single file
const handleDownloadSingle = async (filename: string) => {
  try {
    const { data, error: dlError } = await supabase.storage
      .from('qr-files')
      .download(`${props.shareId}/${filename}`)

    if (dlError) throw dlError
    if (data) {
      downloadBlob(data, filename)
    }
  } catch (err: any) {
    console.error('Failed to download file:', err)
    alert(t('ดาวน์โหลดไฟล์ล้มเหลว กรุณาลองใหม่อีกครั้ง') || 'ดาวน์โหลดไฟล์ล้มเหลว กรุณาลองใหม่อีกครั้ง')
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
      const { data, error: dlError } = await supabase.storage
        .from('qr-files')
        .download(`${props.shareId}/${filename}`)
      
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
    alert(t('สร้างไฟล์บีบอัดล้มเหลว กรุณาลองใหม่อีกครั้ง') || 'สร้างไฟล์บีบอัดล้มเหลว กรุณาลองใหม่อีกครั้ง')
  } finally {
    downloadingAll.value = false
  }
}

const goBackHome = () => {
  window.location.href = window.location.origin + window.location.pathname
}

onMounted(() => {
  fetchShareDetails()
})
</script>

<template>
  <div class="mx-auto w-full max-w-2xl px-4 py-8 text-start">
    
    <!-- Title Area -->
    <div class="mb-6 flex flex-col gap-2">
      <h2 class="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-2xl">
        {{ t('ดาวน์โหลดไฟล์ที่แชร์') || 'ดาวน์โหลดไฟล์ที่แชร์' }}
      </h2>
      <p class="text-xs text-zinc-500 dark:text-zinc-400">
        {{ t('คุณสามารถเลือกดาวน์โหลดแต่ละไฟล์ได้โดยตรง หรือบีบอัดเป็นไฟล์ ZIP เพื่อดาวน์โหลดทั้งหมด') || 'คุณสามารถเลือกดาวน์โหลดแต่ละไฟล์ได้โดยตรง หรือบีบอัดเป็นไฟล์ ZIP เพื่อดาวน์โหลดทั้งหมด' }}
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="glass-card flex flex-col items-center justify-center p-12 text-center">
      <div class="relative flex size-16 items-center justify-center">
        <div class="absolute inset-0 animate-ping rounded-full bg-blue-500/10 dark:bg-blue-400/10"></div>
        <div class="relative flex size-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
          <Loader2 class="size-6 animate-spin" />
        </div>
      </div>
      <h4 class="mt-4 text-sm font-bold text-zinc-800 dark:text-zinc-200">
        {{ t('กำลังโหลดข้อมูลไฟล์ที่แชร์...') || 'กำลังโหลดข้อมูลไฟล์ที่แชร์...' }}
      </h4>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="glass-card border-red-200 bg-red-50/20 p-8 text-center dark:border-red-900/40 dark:bg-red-950/10">
      <div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
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
      <div class="glass-card space-y-6 p-5 md:p-6">
        
        <!-- Archive Summary Info -->
        <div class="flex flex-col gap-3 rounded-2xl border border-zinc-200/60 bg-zinc-50/40 p-4 dark:border-zinc-800/60 dark:bg-zinc-900/10">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <span class="text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                {{ t('ชื่อชุดข้อมูลไฟล์') || 'ชื่อชุดข้อมูลไฟล์' }}
              </span>
              <h3 class="truncate text-sm font-bold text-zinc-800 dark:text-zinc-200">
                {{ shareData.file_name || 'archive.zip' }}
              </h3>
            </div>
            <span class="inline-flex items-center gap-1 rounded-full border border-blue-100/50 bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-600 dark:border-blue-900/30 dark:bg-blue-950/30 dark:text-blue-400">
              <Layers class="size-3" />
              <span>{{ shareData.files_list.length }} {{ t('ไฟล์') || 'ไฟล์' }}</span>
            </span>
          </div>

          <div class="flex items-center justify-between border-t border-zinc-200/40 pt-3 text-[11px] text-zinc-500 dark:border-zinc-800/40 dark:text-zinc-400">
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
          
          <div class="max-h-[300px] space-y-2 overflow-y-auto pr-1">
            <div
              v-for="filename in shareData.files_list"
              :key="filename"
              class="flex items-center justify-between gap-4 rounded-xl border border-zinc-200/60 bg-white p-3 transition hover:bg-zinc-50/50 dark:border-zinc-800/60 dark:bg-zinc-900/20 dark:hover:bg-zinc-900/40"
            >
              <!-- Left: Icon & Name -->
              <div class="flex min-w-0 flex-1 items-center gap-3">
                <div class="dark:border-zinc-850 flex size-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200/60 bg-zinc-50/50 dark:bg-zinc-950">
                  <component
                    :is="getFileTypeMeta(filename).icon"
                    class="size-4.5 text-zinc-500 dark:text-zinc-400"
                  />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="dark:text-zinc-250 truncate text-xs font-bold text-zinc-800">
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

              <!-- Right: Action Download -->
              <button
                @click="handleDownloadSingle(filename)"
                class="hover:text-zinc-850 flex size-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-200"
                :title="t('ดาวน์โหลดไฟล์') || 'ดาวน์โหลดไฟล์'"
              >
                <Download class="size-4" />
              </button>
            </div>
          </div>
        </div>

        <!-- Download All ZIP Button -->
        <div class="border-t border-zinc-200/60 pt-5 dark:border-zinc-800/60">
          <!-- ZIP Download State -->
          <div v-if="downloadingAll" class="space-y-2">
            <div class="text-zinc-650 dark:text-zinc-350 flex items-center justify-between text-xs font-bold">
              <span class="flex items-center gap-1.5">
                <Loader2 class="size-3.5 animate-spin text-blue-600 dark:text-blue-400" />
                <span>{{ t('กำลังดาวน์โหลดไฟล์และบีบอัดเป็น ZIP...') || 'กำลังดาวน์โหลดไฟล์และบีบอัดเป็น ZIP...' }}</span>
              </span>
              <span class="font-mono text-blue-600 dark:text-blue-400">{{ downloadProgress }}%</span>
            </div>
            <div class="h-2 w-full overflow-hidden rounded-full border border-zinc-200/20 bg-zinc-100 dark:bg-zinc-800">
              <div
                class="h-full bg-blue-600 transition-all duration-300 dark:bg-blue-500"
                :style="{ width: `${downloadProgress}%` }"
              ></div>
            </div>
          </div>

          <button
            v-else
            @click="handleDownloadAllZip"
            class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-bold text-white shadow-md shadow-blue-500/10 transition hover:bg-blue-700 active:scale-[0.99]"
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
  </div>
</template>
