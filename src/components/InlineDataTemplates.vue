<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import JSZip from 'jszip'
import { supabase, isSupabaseConfigured } from '@/utils/supabase'
import {
  detectDataType,
  generateEmailData,
  generateEventData,
  generateLocationData,
  generatePhoneData,
  generateSmsData,
  generateTextData,
  generateUrlData,
  generateVCardData,
  generateWifiData
} from '@/utils/dataEncoding'
import {
  Link,
  Wifi,
  User,
  Mail,
  MessageSquare,
  Phone as PhoneIcon,
  MapPin,
  Calendar,
  Paperclip,
  FileText,
  Trash2,
  Sparkles,
  UploadCloud,
  AlertCircle,
  FileSpreadsheet,
  FileArchive,
  FileImage,
  FileAudio,
  FileVideo,
  FileCode,
  File as FileIcon,
  Plus,
  X,
  Edit3,
  CheckCircle,
  Copy
} from 'lucide-vue-next'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const { t } = useI18n()

// Selection state
const selectedType = ref('url')

// Internal flag to prevent infinite loops during reactive sync
let isUpdatingFromInside = false

// --- Templates State ---

// Plain Text
const textData = ref('')

// URL
const urlData = ref('')

// WiFi
const wifiSSID = ref('')
const wifiPassword = ref('')
const wifiEncryption = ref('WPA')
const wifiHidden = ref(false)

// Email
const emailAddress = ref('')
const emailSubject = ref('')
const emailBody = ref('')
const emailCc = ref('')
const emailBcc = ref('')

// SMS
const smsNumber = ref('')
const smsMessage = ref('')

// Phone
const phoneNumber = ref('')

// Location
const locationLatitude = ref('')
const locationLongitude = ref('')

// Event
const eventTitle = ref('')
const eventLocation = ref('')
const eventStartTime = ref('')
const eventEndTime = ref('')

// Files Upload State
interface UploadableFile {
  id: string
  file: File
  name: string
  previewUrl?: string // image thumbnail preview Object URL
}
const filesToUpload = ref<UploadableFile[]>([])
const uploading = ref(false)
const uploadProgress = ref('')
const uploadError = ref('')
const filesInputRef = ref<HTMLInputElement | null>(null)

// Custom note and custom ZIP name state
const showNoteEditor = ref(false)
const noteTitle = ref('')
const noteContent = ref('')
const customZipName = ref('')

const uploadSuccess = ref(false)
const uploadedShareUrl = ref('')
const totalSizeUploaded = ref(0)
const uploadedFilesCount = ref(0)
const currentUploadingFileIndex = ref(0)
const currentUploadingFileName = ref('')
const uploadProgressPercent = ref(0)

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const copyLinkSuccess = ref(false)
const handleCopyLink = async () => {
  if (!uploadedShareUrl.value) return
  try {
    await navigator.clipboard.writeText(uploadedShareUrl.value)
    copyLinkSuccess.value = true
    setTimeout(() => {
      copyLinkSuccess.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy', err)
  }
}

const resetUploadState = () => {
  filesToUpload.value.forEach(item => {
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl)
    }
  })
  filesToUpload.value = []
  customZipName.value = ''
  uploadSuccess.value = false
  uploadedShareUrl.value = ''
  uploadError.value = ''
  triggerDataGeneration()
}

// --- Helper Actions ---

const triggerFileInput = () => {
  if (uploading.value) return
  filesInputRef.value?.click()
}

const addFilesToList = (files: File[]) => {
  const mapped = files.map(file => {
    const isImage = file.type.startsWith('image/')
    const previewUrl = isImage ? URL.createObjectURL(file) : undefined
    return {
      id: window.crypto.randomUUID(),
      file,
      name: file.name,
      previewUrl
    }
  })
  filesToUpload.value = [...filesToUpload.value, ...mapped]
  triggerDataGeneration()
}

const handleFileSelection = (e: Event) => {
  const target = e.target as HTMLInputElement
  const selectedFiles = Array.from(target.files || [])
  addFilesToList(selectedFiles)
}

const onFilesDrop = (e: DragEvent) => {
  if (uploading.value) return
  if (e.dataTransfer?.files) {
    const droppedFiles = Array.from(e.dataTransfer.files)
    addFilesToList(droppedFiles)
  }
}

const removeFile = (index: number) => {
  if (uploading.value) return
  const removed = filesToUpload.value[index]
  if (removed.previewUrl) {
    URL.revokeObjectURL(removed.previewUrl)
  }
  filesToUpload.value.splice(index, 1)
  triggerDataGeneration()
}

const onFilenameKeypress = (event: KeyboardEvent) => {
  const illegalChars = /[\\/:*?"<>|]/
  if (illegalChars.test(event.key)) {
    event.preventDefault()
  }
}

// Clipboard Paste Listener
const handlePaste = (e: ClipboardEvent) => {
  if (uploading.value) return
  if (selectedType.value !== 'files') return

  const items = e.clipboardData?.items
  if (!items) return

  const files: File[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.kind === 'file') {
      const file = item.getAsFile()
      if (file) {
        // Fallback name for clipboard images/files
        const timestamp = new Date().getTime()
        const defaultExt = file.type.split('/')[1] || 'png'
        const defaultName = file.type.startsWith('image/')
          ? `pasted-image-${timestamp}.${defaultExt}`
          : `pasted-file-${timestamp}`
        
        const finalFile = new File(
          [file],
          file.name === 'image.png' || !file.name ? defaultName : file.name,
          { type: file.type }
        )
        files.push(finalFile)
      }
    }
  }

  if (files.length > 0) {
    addFilesToList(files)
  }
}

const windowPasteHandler = (e: ClipboardEvent) => {
  if (selectedType.value === 'files') {
    handlePaste(e)
  }
}

onMounted(() => {
  window.addEventListener('paste', windowPasteHandler)
})

onBeforeUnmount(() => {
  window.removeEventListener('paste', windowPasteHandler)
  filesToUpload.value.forEach(item => {
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl)
    }
  })
})

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

// Text note creator
const createTextNoteFile = (title: string, content: string) => {
  let filename = title.trim()
  if (!filename) filename = 'note'
  if (!filename.toLowerCase().endsWith('.txt')) {
    filename += '.txt'
  }
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const file = new File([blob], filename, { type: 'text/plain' })
  addFilesToList([file])
}

const handleAddNote = () => {
  if (!noteTitle.value.trim()) {
    return
  }
  createTextNoteFile(noteTitle.value, noteContent.value)
  noteTitle.value = ''
  noteContent.value = ''
  showNoteEditor.value = false
}

// --- Data Generator ---

const triggerDataGeneration = () => {
  if (selectedType.value === 'files') {
    // Files cannot be generated instantly, user needs to click 'Upload'
    return
  }

  isUpdatingFromInside = true
  let generated = ''

  switch (selectedType.value) {
    case 'text':
      generated = generateTextData({ text: textData.value })
      break
    case 'url':
      generated = generateUrlData({ url: urlData.value })
      break
    case 'email':
      generated = generateEmailData({
        address: emailAddress.value,
        subject: emailSubject.value,
        body: emailBody.value,
        cc: emailCc.value,
        bcc: emailBcc.value
      })
      break
    case 'phone':
      generated = generatePhoneData({ phone: phoneNumber.value })
      break
    case 'sms':
      generated = generateSmsData({ phone: smsNumber.value, message: smsMessage.value })
      break
    case 'wifi':
      generated = generateWifiData({
        ssid: wifiSSID.value,
        password: wifiPassword.value,
        encryption: wifiEncryption.value as 'nopass' | 'WEP' | 'WPA',
        hidden: wifiHidden.value
      })
      break
    case 'vcard':
      generated = generateVCardData({
        firstName: vcardFirstName.value,
        lastName: vcardLastName.value,
        org: vcardOrg.value,
        position: vcardPosition.value,
        phoneWork: vcardPhoneWork.value,
        phonePrivate: vcardPhonePrivate.value,
        phoneMobile: vcardPhoneMobile.value,
        email: vcardEmail.value,
        website: vcardWebsite.value,
        street: vcardStreet.value,
        zipcode: vcardZipcode.value,
        city: vcardCity.value,
        state: vcardState.value,
        country: vcardCountry.value,
        version: vcardVersion.value
      })
      break
    case 'location':
      generated = generateLocationData({
        latitude: locationLatitude.value,
        longitude: locationLongitude.value
      })
      break
    case 'event':
      generated = generateEventData({
        title: eventTitle.value,
        location: eventLocation.value,
        startTime: eventStartTime.value,
        endTime: eventEndTime.value
      })
      break
  }

  emit('update:modelValue', generated)
  setTimeout(() => {
    isUpdatingFromInside = false
  }, 50)
}

// vCard specific state
const vcardFirstName = ref('')
const vcardLastName = ref('')
const vcardOrg = ref('')
const vcardPosition = ref('')
const vcardPhoneWork = ref('')
const vcardPhonePrivate = ref('')
const vcardPhoneMobile = ref('')
const vcardEmail = ref('')
const vcardWebsite = ref('')
const vcardStreet = ref('')
const vcardZipcode = ref('')
const vcardCity = ref('')
const vcardState = ref('')
const vcardCountry = ref('')
const vcardVersion = ref('3')

// Upload files individually workflow
const handleFileUploadWorkflow = async () => {
  if (!isSupabaseConfigured) {
    uploadError.value = t('Supabase credentials missing. Check your settings.')
    return
  }
  if (filesToUpload.value.length === 0) return

  uploading.value = true
  uploadError.value = ''
  uploadSuccess.value = false
  uploadProgressPercent.value = 0

  try {
    const fileId = window.crypto.randomUUID()
    const usedNames = new Set<string>()
    const finalZipNameList: string[] = []
    let totalSize = 0

    const getFileExtension = (filename: string): string => {
      const parts = filename.split('.')
      return parts.length > 1 ? `.${parts.pop()}` : ''
    }

    // Resolve naming conflicts
    const preparedFiles = filesToUpload.value.map(item => {
      let name = item.name.trim().replace(/[\\/:*?"<>|]/g, '')
      if (!name) name = 'unnamed'
      const originalExt = getFileExtension(item.file.name)
      if (originalExt && !name.toLowerCase().endsWith(originalExt.toLowerCase())) {
        name = name + originalExt
      }

      let finalName = name
      let counter = 1
      const nameWithoutExt = originalExt ? name.slice(0, -originalExt.length) : name

      while (usedNames.has(finalName.toLowerCase())) {
        finalName = `${nameWithoutExt} (${counter})${originalExt}`
        counter++
      }

      usedNames.add(finalName.toLowerCase())
      finalZipNameList.push(finalName)
      totalSize += item.file.size
      return {
        file: item.file,
        finalName
      }
    })

    // Upload files individually in a loop
    let uploadedCount = 0
    for (const prepared of preparedFiles) {
      currentUploadingFileIndex.value = uploadedCount
      currentUploadingFileName.value = prepared.finalName
      
      const filePath = `${fileId}/${prepared.finalName}`
      
      // Calculate progress percentage
      uploadProgressPercent.value = Math.round((uploadedCount / preparedFiles.length) * 100)

      const { error: uploadErrorDetails } = await supabase.storage
        .from('qr-files')
        .upload(filePath, prepared.file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadErrorDetails) throw uploadErrorDetails
      uploadedCount++
    }

    uploadProgressPercent.value = 90

    // Process custom zip name
    let cleanCustomName = customZipName.value.trim().replace(/[\\/:*?"<>|]/g, '')
    if (cleanCustomName) {
      if (!cleanCustomName.toLowerCase().endsWith('.zip')) {
        cleanCustomName += '.zip'
      }
    } else {
      cleanCustomName = 'archive.zip'
    }

    // Create share landing page link
    const shareUrl = window.location.origin + window.location.pathname + '?id=' + fileId

    // Insert log record to DB
    const { error: dbError } = await supabase
      .from('qr_files_log')
      .insert({
        id: fileId,
        file_name: cleanCustomName,
        file_url: shareUrl,
        file_size: totalSize,
        files_list: finalZipNameList
      })

    if (dbError) throw dbError

    uploadProgressPercent.value = 100
    uploadedShareUrl.value = shareUrl
    totalSizeUploaded.value = totalSize
    uploadedFilesCount.value = preparedFiles.length
    uploadSuccess.value = true

    isUpdatingFromInside = true
    emit('update:modelValue', shareUrl)
    setTimeout(() => {
      isUpdatingFromInside = false
    }, 50)

  } catch (err: any) {
    console.error('File upload failed:', err)
    uploadError.value = err.message || t('การอัปโหลดล้มเหลว กรุณาลองใหม่อีกครั้ง')
  } finally {
    uploading.value = false
  }
}

// Watch inputs of active forms to trigger data updates reactively
watch([textData, urlData, wifiSSID, wifiPassword, wifiEncryption, wifiHidden,
       emailAddress, emailSubject, emailBody, emailCc, emailBcc,
       smsNumber, smsMessage, phoneNumber, locationLatitude, locationLongitude,
       eventTitle, eventLocation, eventStartTime, eventEndTime,
       vcardFirstName, vcardLastName, vcardOrg, vcardPosition, vcardPhoneWork, vcardPhonePrivate, vcardPhoneMobile, vcardEmail, vcardWebsite, vcardStreet, vcardZipcode, vcardCity, vcardState, vcardCountry, vcardVersion], () => {
  triggerDataGeneration()
})

// Watch selectedType to trigger updates
watch(selectedType, () => {
  uploadError.value = ''
  triggerDataGeneration()
})

// Auto-detect incoming type and pre-fill form fields
watch(() => props.modelValue, (newVal) => {
  if (isUpdatingFromInside) return

  // Run parser
  const detection = detectDataType(newVal)
  if (detection.type) {
    selectedType.value = detection.type

    // Populate corresponding fields
    const d = detection.parsedData
    switch (detection.type) {
      case 'text':
        textData.value = (d.text as string) || ''
        break
      case 'url':
        urlData.value = (d.url as string) || ''
        break
      case 'wifi':
        wifiSSID.value = (d.ssid as string) || ''
        wifiPassword.value = (d.password as string) || ''
        wifiEncryption.value = (d.encryption as string) || 'WPA'
        wifiHidden.value = (d.hidden as boolean) || false
        break
      case 'email':
        emailAddress.value = (d.address as string) || ''
        emailSubject.value = (d.subject as string) || ''
        emailBody.value = (d.body as string) || ''
        emailCc.value = (d.cc as string) || ''
        emailBcc.value = (d.bcc as string) || ''
        break
      case 'phone':
        phoneNumber.value = (d.phone as string) || ''
        break
      case 'sms':
        smsNumber.value = (d.phone as string) || ''
        smsMessage.value = (d.message as string) || ''
        break
      case 'vcard':
        vcardFirstName.value = (d.firstName as string) || ''
        vcardLastName.value = (d.lastName as string) || ''
        vcardOrg.value = (d.org as string) || ''
        vcardPosition.value = (d.position as string) || ''
        vcardPhoneWork.value = (d.phoneWork as string) || ''
        vcardPhonePrivate.value = (d.phonePrivate as string) || ''
        vcardPhoneMobile.value = (d.phoneMobile as string) || ''
        vcardEmail.value = (d.email as string) || ''
        vcardWebsite.value = (d.website as string) || ''
        vcardStreet.value = (d.street as string) || ''
        vcardZipcode.value = (d.zipcode as string) || ''
        vcardCity.value = (d.city as string) || ''
        vcardState.value = (d.state as string) || ''
        vcardCountry.value = (d.country as string) || ''
        vcardVersion.value = (d.version as string) || '3'
        break
      case 'location':
        locationLatitude.value = (d.latitude as string) || ''
        locationLongitude.value = (d.longitude as string) || ''
        break
      case 'event':
        eventTitle.value = (d.title as string) || ''
        eventLocation.value = (d.location as string) || ''
        eventStartTime.value = (d.startTime as string) || ''
        eventEndTime.value = (d.endTime as string) || ''
        break
    }
  }
}, { immediate: true })

// Categories list for template selection
const categories = [
  { id: 'url', label: 'URL', icon: Link },
  { id: 'text', label: 'ข้อความ', icon: FileText },
  { id: 'wifi', label: 'Wi-Fi', icon: Wifi },
  { id: 'vcard', label: 'นามบัตร vCard', icon: User },
  { id: 'email', label: 'อีเมล', icon: Mail },
  { id: 'sms', label: 'SMS', icon: MessageSquare },
  { id: 'phone', label: 'เบอร์โทร', icon: PhoneIcon },
  { id: 'location', label: 'แผนที่', icon: MapPin },
  { id: 'event', label: 'ปฏิทิน', icon: Calendar },
  { id: 'files', label: 'แนบไฟล์', icon: Paperclip }
]
</script>

<template>
  <div class="w-full space-y-4">
    <!-- Categories Navigation Tab Bar -->
    <div class="flex w-full flex-wrap gap-1.5 border-b border-zinc-200/60 pb-2.5 dark:border-zinc-800/60">
      <button
        v-for="cat in categories"
        :key="cat.id"
        type="button"
        @click="selectedType = cat.id"
        :disabled="uploading"
        :class="[
          'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold outline-none transition-all duration-200',
          selectedType === cat.id
            ? 'bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
            : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/40 dark:hover:text-zinc-200',
          uploading && 'cursor-not-allowed opacity-50'
        ]"
      >
        <component :is="cat.icon" class="size-3.5" />
        <span>{{ cat.label }}</span>
      </button>
    </div>

    <!-- Active Form Display Area -->
    <div class="mt-2 text-zinc-800 dark:text-zinc-200">
      
      <!-- 1. Text Form -->
      <div v-if="selectedType === 'text'" class="space-y-1">
        <textarea
          id="data"
          v-model="textData"
          rows="4"
          class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5 text-sm text-input outline-none transition-all dark:border-zinc-800 dark:bg-zinc-950/20"
          :placeholder="t('พิมพ์ข้อความที่ต้องการเข้ารหัส...')"
        ></textarea>
      </div>

      <!-- 2. URL Form -->
      <div v-if="selectedType === 'url'" class="space-y-1">
        <input
          id="data"
          v-model="urlData"
          type="text"
          class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3.5 py-2.5 text-sm text-input outline-none transition-all dark:border-zinc-800 dark:bg-zinc-950/20"
          placeholder="https://example.com"
        />
      </div>

      <!-- 3. WiFi Form -->
      <div v-if="selectedType === 'wifi'" class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div class="space-y-1 sm:col-span-2">
          <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">SSID / ชื่อเครือข่าย</label>
          <input
            v-model="wifiSSID"
            type="text"
            class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3.5 py-2 text-sm text-input outline-none transition-all dark:border-zinc-800 dark:bg-zinc-950/20"
            placeholder="Home-Wifi"
          />
        </div>
        <div class="space-y-1">
          <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">รหัสผ่านเครือข่าย</label>
          <input
            v-model="wifiPassword"
            type="password"
            :disabled="wifiEncryption === 'nopass'"
            class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3.5 py-2 text-sm text-input outline-none transition-all disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950/20"
            placeholder="••••••••"
          />
        </div>
        <div class="space-y-1">
          <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">ระบบความปลอดภัย</label>
          <select
            v-model="wifiEncryption"
            class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3.5 py-2 text-sm text-input outline-none transition-all dark:border-zinc-800 dark:bg-zinc-950/20"
          >
            <option value="WPA">WPA/WPA2</option>
            <option value="WEP">WEP</option>
            <option value="nopass">ไม่มีรหัสผ่าน (Open)</option>
          </select>
        </div>
        <div class="flex items-center gap-2 pt-1 sm:col-span-2">
          <input
            id="wifi-hidden"
            v-model="wifiHidden"
            type="checkbox"
            class="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-700"
          />
          <label for="wifi-hidden" class="text-xs font-medium text-zinc-600 dark:text-zinc-300">เป็นเครือข่ายที่ซ่อนชื่อ SSID ไว้ (Hidden Network)</label>
        </div>
      </div>

      <!-- 4. vCard Form -->
      <div v-if="selectedType === 'vcard'" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="space-y-1">
          <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">ชื่อ</label>
          <input v-model="vcardFirstName" type="text" class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3 py-1.5 text-xs text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20" placeholder="สมชาย" />
        </div>
        <div class="space-y-1">
          <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">นามสกุล</label>
          <input v-model="vcardLastName" type="text" class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3 py-1.5 text-xs text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20" placeholder="ใจดี" />
        </div>
        <div class="space-y-1">
          <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">บริษัท/องค์กร</label>
          <input v-model="vcardOrg" type="text" class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3 py-1.5 text-xs text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20" placeholder="เทศบาลนครนครสวรรค์" />
        </div>
        <div class="space-y-1">
          <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">ตำแหน่งงาน</label>
          <input v-model="vcardPosition" type="text" class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3 py-1.5 text-xs text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20" placeholder="นักวิชาการคอมพิวเตอร์" />
        </div>
        <div class="space-y-1">
          <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">เบอร์โทรศัพท์มือถือ</label>
          <input v-model="vcardPhoneMobile" type="text" class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3 py-1.5 text-xs text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20" placeholder="089-xxx-xxxx" />
        </div>
        <div class="space-y-1">
          <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">เบอร์โทรศัพท์ที่ทำงาน</label>
          <input v-model="vcardPhoneWork" type="text" class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3 py-1.5 text-xs text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20" placeholder="056-xxx-xxx" />
        </div>
        <div class="space-y-1 sm:col-span-2">
          <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">อีเมล</label>
          <input v-model="vcardEmail" type="email" class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3 py-1.5 text-xs text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20" placeholder="somchai@nakhonsawan.go.th" />
        </div>
        <div class="space-y-1 sm:col-span-2">
          <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">เว็บไซต์</label>
          <input v-model="vcardWebsite" type="text" class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3 py-1.5 text-xs text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20" placeholder="www.nsm.go.th" />
        </div>
        <div class="space-y-1 sm:col-span-2">
          <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">ที่อยู่ (บ้านเลขที่/ถนน)</label>
          <input v-model="vcardStreet" type="text" class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3 py-1.5 text-xs text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20" placeholder="105/1 ถ.สวรรค์วิถี" />
        </div>
        <div class="grid grid-cols-2 gap-2 sm:col-span-2">
          <div class="space-y-1">
            <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">เมือง/อำเภอ</label>
            <input v-model="vcardCity" type="text" class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3 py-1.5 text-xs text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20" placeholder="เมืองนครสวรรค์" />
          </div>
          <div class="space-y-1">
            <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">จังหวัด</label>
            <input v-model="vcardState" type="text" class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3 py-1.5 text-xs text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20" placeholder="นครสวรรค์" />
          </div>
          <div class="space-y-1">
            <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">รหัสไปรษณีย์</label>
            <input v-model="vcardZipcode" type="text" class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3 py-1.5 text-xs text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20" placeholder="60000" />
          </div>
          <div class="space-y-1">
            <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">เวอร์ชัน vCard</label>
            <select v-model="vcardVersion" class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3 py-1.5 text-xs text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20">
              <option value="3">vCard 3.0 (แนะนำ)</option>
              <option value="4">vCard 4.0 (ล่าสุด)</option>
              <option value="2">vCard 2.1 (รุ่นเก่า)</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 5. Email Form -->
      <div v-if="selectedType === 'email'" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="space-y-1 sm:col-span-2">
          <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">ส่งถึงผู้รับ (Email To)</label>
          <input v-model="emailAddress" type="email" class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3.5 py-2 text-sm text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20" placeholder="receiver@example.com" />
        </div>
        <div class="space-y-1 sm:col-span-2">
          <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">หัวข้ออีเมล (Subject)</label>
          <input v-model="emailSubject" type="text" class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3.5 py-2 text-sm text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20" placeholder="สอบถามข้อมูลบริการ" />
        </div>
        <div class="space-y-1 sm:col-span-2">
          <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">เนื้อหาอีเมล (Body)</label>
          <textarea v-model="emailBody" rows="3" class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3 text-sm text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20" placeholder="รายละเอียดข้อความ..."></textarea>
        </div>
      </div>

      <!-- 6. SMS Form -->
      <div v-if="selectedType === 'sms'" class="grid grid-cols-1 gap-3.5">
        <div class="space-y-1">
          <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">เบอร์โทรศัพท์ผู้รับ</label>
          <input v-model="smsNumber" type="text" class="py-2c w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3.5 text-sm text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20" placeholder="089xxxxxxx" />
        </div>
        <div class="space-y-1">
          <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">ข้อความที่จะส่ง</label>
          <textarea v-model="smsMessage" rows="3" class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5 text-sm text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20" placeholder="พิมพ์ข้อความสั้น..."></textarea>
        </div>
      </div>

      <!-- 7. Phone Form -->
      <div v-if="selectedType === 'phone'" class="space-y-1">
        <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">เบอร์โทรศัพท์ที่ต้องการโทร</label>
        <input v-model="phoneNumber" type="text" class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3.5 py-2.5 text-sm text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20" placeholder="056-219555" />
      </div>

      <!-- 8. Location Form -->
      <div v-if="selectedType === 'location'" class="grid grid-cols-2 gap-3.5">
        <div class="space-y-1">
          <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">ละติจูด (Latitude)</label>
          <input v-model="locationLatitude" type="text" class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3.5 py-2 text-sm text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20" placeholder="15.7042" />
        </div>
        <div class="space-y-1">
          <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">ลองจิจูด (Longitude)</label>
          <input v-model="locationLongitude" type="text" class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3.5 py-2 text-sm text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20" placeholder="100.1235" />
        </div>
      </div>

      <!-- 9. Event Form -->
      <div v-if="selectedType === 'event'" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="space-y-1 sm:col-span-2">
          <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">หัวข้อกิจกรรม (Event Title)</label>
          <input v-model="eventTitle" type="text" class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3.5 py-2.5 text-sm text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20" placeholder="ประชุมสภาเทศบาล" />
        </div>
        <div class="space-y-1 sm:col-span-2">
          <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">สถานที่จัดงาน (Location)</label>
          <input v-model="eventLocation" type="text" class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3.5 py-2.5 text-sm text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20" placeholder="ห้องประชุมชั้น 3 เทศบาลนครนครสวรรค์" />
        </div>
        <div class="space-y-1">
          <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">เวลาเริ่มต้น (Start Time)</label>
          <input v-model="eventStartTime" type="datetime-local" class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3.5 py-2 text-sm text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20" />
        </div>
        <div class="space-y-1">
          <label class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">เวลาสิ้นสุด (End Time)</label>
          <input v-model="eventEndTime" type="datetime-local" class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3.5 py-2 text-sm text-input outline-none dark:border-zinc-800 dark:bg-zinc-950/20" />
        </div>
      </div>

      <!-- 10. Supabase Files Form -->
      <div v-if="selectedType === 'files'" class="space-y-4">
        <div v-if="!isSupabaseConfigured" class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400">
          <div class="flex gap-2.5">
            <AlertCircle class="size-5 shrink-0 text-amber-500" />
            <div>
              <p class="font-bold">⚠️ ระบบอัปโหลดไฟล์ยังไม่ได้เปิดใช้งาน</p>
              <p class="mt-1 leading-relaxed text-zinc-600 dark:text-zinc-300">กรุณาตั้งค่าความเชื่อมต่อ Supabase ในไฟล์ `.env` เพื่อให้สามารถใช้งานอัปโหลดไฟล์ร่วมกันเป็น QR code ได้</p>
            </div>
          </div>
        </div>

        <div v-else class="space-y-3.5">
          <!-- State A: Uploading Progress -->
          <div v-if="uploading" class="glass-card space-y-4 rounded-2xl border border-blue-100 bg-blue-50/5 p-6 text-center shadow-lg dark:border-blue-900/40 dark:bg-blue-950/10">
            <div class="flex flex-col items-center justify-center">
              <div class="relative flex size-16 items-center justify-center">
                <!-- Circular Pulsing Ring -->
                <div class="absolute inset-0 animate-ping rounded-full bg-blue-500/10 dark:bg-blue-400/10"></div>
                <div class="relative flex size-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                  <UploadCloud class="size-6 animate-pulse" />
                </div>
              </div>
              <h4 class="mt-3 text-xs font-bold text-zinc-800 dark:text-zinc-200">{{ t('กำลังอัปโหลดไฟล์...') }}</h4>
              <p class="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                {{ t('กำลังอัปโหลดไฟล์ที่') }} {{ currentUploadingFileIndex + 1 }} {{ t('จาก') }} {{ filesToUpload.length }}: 
                <span class="dark:text-zinc-350 inline-block max-w-[200px] truncate align-bottom font-semibold text-zinc-700">{{ currentUploadingFileName }}</span>
              </p>
            </div>

            <!-- Progress bar -->
            <div class="space-y-1">
              <div class="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div 
                  class="h-full bg-blue-600 transition-all duration-300 ease-out dark:bg-blue-500" 
                  :style="{ width: `${uploadProgressPercent}%` }"
                ></div>
              </div>
              <div class="flex justify-end font-mono text-[9px] text-zinc-400">
                <span>{{ uploadProgressPercent }}%</span>
              </div>
            </div>
          </div>

          <!-- State B: Upload Success Summary -->
          <div v-else-if="uploadSuccess" class="glass-card space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/5 p-5 shadow-lg dark:border-emerald-900/40 dark:bg-emerald-950/10">
            <div class="flex flex-col items-center justify-center text-center">
              <div class="mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                <CheckCircle class="size-6 animate-bounce" />
              </div>
              <h4 class="text-xs font-bold text-zinc-800 dark:text-zinc-100">{{ t('อัปโหลดไฟล์เสร็จสมบูรณ์!') }}</h4>
              <p class="text-zinc-450 mt-1 text-[10px] dark:text-zinc-500">{{ t('สร้างรหัส QR Code เรียบร้อยแล้ว สแกนเพื่อเข้าถึงไฟล์ได้ทันที') }}</p>
            </div>

            <!-- Summary Details -->
            <div class="text-zinc-650 dark:text-zinc-350 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50/50 p-3.5 text-xs dark:border-zinc-800/80 dark:bg-zinc-950/20">
              <div class="flex items-center justify-between border-b border-zinc-200/60 pb-1.5 dark:border-zinc-800/60">
                <span class="font-semibold text-zinc-400">{{ t('ชื่อคลังเก็บไฟล์') }}:</span>
                <span class="font-mono font-bold text-zinc-700 dark:text-zinc-200">{{ customZipName || 'archive.zip' }}</span>
              </div>
              <div class="flex items-center justify-between border-b border-zinc-200/60 pb-1.5 dark:border-zinc-800/60">
                <span class="font-semibold text-zinc-400">{{ t('จำนวนไฟล์ทั้งหมด') }}:</span>
                <span class="font-bold text-zinc-700 dark:text-zinc-200">{{ uploadedFilesCount }} {{ t('ไฟล์') }}</span>
              </div>
              <div class="flex items-center justify-between border-b border-zinc-200/60 pb-1.5 dark:border-zinc-800/60">
                <span class="font-semibold text-zinc-400">{{ t('ขนาดไฟล์รวม') }}:</span>
                <span class="font-mono font-bold text-zinc-700 dark:text-zinc-200">{{ formatSize(totalSizeUploaded) }}</span>
              </div>
              <!-- File listing -->
              <div class="pt-1">
                <span class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">{{ t('รายชื่อไฟล์ที่แนบ') }}</span>
                <div class="max-h-24 space-y-1 overflow-y-auto">
                  <div v-for="item in filesToUpload" :key="item.id" class="flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                    <span class="size-1.5 rounded-full bg-zinc-400"></span>
                    <span class="truncate">{{ item.name }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-2">
              <button
                type="button"
                @click="handleCopyLink"
                class="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white py-2 text-xs font-semibold text-zinc-700 outline-none hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Copy class="size-3.5" />
                <span>{{ copyLinkSuccess ? t('คัดลอกแล้ว!') : t('คัดลอกลิงก์แชร์') }}</span>
              </button>
              <button
                type="button"
                @click="resetUploadState"
                class="bg-blue-650 flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold text-white shadow-md shadow-blue-500/10 outline-none hover:bg-blue-700"
              >
                <Plus class="size-3.5" />
                <span>{{ t('อัปโหลดชุดใหม่') }}</span>
              </button>
            </div>
          </div>

          <!-- State C: Upload Failed Summary -->
          <div v-else-if="uploadError" class="glass-card space-y-4 rounded-2xl border border-red-100 bg-red-50/5 p-5 shadow-lg dark:border-red-900/40 dark:bg-red-950/10">
            <div class="flex flex-col items-center justify-center text-center">
              <div class="mb-3 flex size-12 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400">
                <AlertCircle class="size-6 animate-pulse" />
              </div>
              <h4 class="dark:text-zinc-150 text-xs font-bold text-zinc-800">{{ t('การอัปโหลดล้มเหลว') || 'การอัปโหลดล้มเหลว' }}</h4>
              <p class="text-red-650 mt-1 text-[10px] font-semibold dark:text-red-400">{{ uploadError }}</p>
            </div>

            <!-- Recommendations / Troubleshooting -->
            <div class="text-zinc-650 dark:text-zinc-350 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50/50 p-3.5 text-[10px] dark:border-zinc-800/80 dark:bg-zinc-950/20">
              <p class="font-bold text-zinc-700 dark:text-zinc-300">💡 คำแนะนำการเปิดใช้ระบบฝากไฟล์:</p>
              <ul class="list-decimal space-y-1 pl-4 leading-relaxed text-zinc-600 dark:text-zinc-400">
                <li>เปิดหน้า Supabase Dashboard สรรสร้างพื้นที่จัดเก็บถัง (Storage Bucket) ชื่อ <code class="rounded bg-zinc-200 px-1 font-mono dark:bg-zinc-800">qr-files</code></li>
                <li>ตั้งค่า Bucket เป็นสิทธิ์ <strong class="underline">Public</strong> เพื่อดาวน์โหลดข้อมูลผ่าน QR ได้</li>
                <li>ตรวจสอบสิทธิ์เข้าถึงของนโยบายความปลอดภัย RLS ของ Bucket</li>
              </ul>
            </div>

            <!-- Action -->
            <div class="flex justify-center">
              <button
                type="button"
                @click="uploadError = ''"
                class="flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/10 outline-none hover:bg-blue-700 active:scale-[0.99]"
              >
                <span>{{ t('ลองใหม่อีกครั้ง') || 'ลองใหม่อีกครั้ง' }}</span>
              </button>
            </div>
          </div>

          <!-- State D: Queue & Upload Form (Default) -->
          <div v-else class="space-y-3.5">
            <!-- Dropzone area -->
            <div 
              @click="triggerFileInput"
              @dragover.prevent
              @drop.prevent="onFilesDrop"
              :class="[
                'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center outline-none transition-all duration-200 focus-within:ring-2 focus-within:ring-blue-500/20',
                filesToUpload.length > 0 
                  ? 'border-blue-400 bg-blue-50/20 dark:border-blue-700 dark:bg-blue-950/10'
                  : 'border-zinc-200 hover:border-blue-400 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/30',
                uploading && 'cursor-not-allowed opacity-50'
              ]"
            >
              <input 
                ref="filesInputRef" 
                type="file" 
                multiple 
                class="hidden" 
                @change="handleFileSelection"
                :disabled="uploading"
              />
              <UploadCloud class="mb-2 size-9 animate-bounce text-zinc-400 duration-1000 dark:text-zinc-600" />
              <p class="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{{ t('เลือกไฟล์ข้อมูล, ลากวาง หรือ กด Ctrl+V เพื่อวาง') }}</p>
              <p class="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">{{ t('รองรับไฟล์หลากหลายขนาดรวมกันสูงสุด 10 MB') }}</p>
            </div>

            <!-- Note Editor Form Toggle -->
            <div v-if="showNoteEditor" class="space-y-2.5 rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950/20">
              <div class="flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300">
                <span class="flex items-center gap-1">
                  <Edit3 class="size-3.5 text-blue-600 dark:text-blue-400" />
                  <span>{{ t('เขียนโน้ตด่วนแนบไฟล์') || 'เขียนโน้ตด่วนแนบไฟล์' }}</span>
                </span>
                <button type="button" @click="showNoteEditor = false" class="text-zinc-450 hover:text-zinc-650 dark:hover:text-zinc-250">
                  <X class="size-3.5" />
                </button>
              </div>
              <div class="space-y-2">
                <input
                  type="text"
                  v-model="noteTitle"
                  placeholder="ชื่อหัวข้อโน้ต (เช่น ขั้นตอนแนะนำ.txt)"
                  class="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <textarea
                  v-model="noteContent"
                  rows="3"
                  placeholder="พิมพ์เนื้อหาโน้ตตรงนี้..."
                  class="w-full rounded-lg border border-zinc-200 bg-white p-2.5 text-xs outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                ></textarea>
              </div>
              <div class="flex justify-end gap-2 text-xs font-semibold">
                <button
                  type="button"
                  @click="showNoteEditor = false"
                  class="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  {{ t('ยกเลิก') || 'ยกเลิก' }}
                </button>
                <button
                  type="button"
                  @click="handleAddNote"
                  :disabled="!noteTitle.trim()"
                  class="bg-blue-650 rounded-lg px-3 py-1.5 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {{ t('เพิ่มเข้าคิว') || 'เพิ่มเข้าคิว' }}
                </button>
              </div>
            </div>

            <!-- Queue listing of chosen files -->
            <div v-if="filesToUpload.length > 0" class="space-y-3">
              <div class="flex items-center justify-between text-xs font-bold text-zinc-500">
                <span class="flex items-center gap-1">
                  <span>{{ t('ไฟล์ที่เลือก') }} ({{ filesToUpload.length }})</span>
                  <span class="rounded bg-blue-100 px-1 py-0.5 font-mono text-[9px] font-bold text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">Ctrl+V ได้</span>
                </span>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    v-if="!showNoteEditor"
                    @click="showNoteEditor = true"
                    :disabled="uploading"
                    class="flex items-center gap-0.5 text-[11px] font-semibold text-blue-600 outline-none hover:text-blue-700 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <Plus class="size-3" />
                    <span>{{ t('เขียนโน้ตด่วน') || 'เขียนโน้ตด่วน' }}</span>
                  </button>
                  <span class="text-zinc-300 dark:text-zinc-700">|</span>
                  <button 
                    type="button" 
                    @click="filesToUpload = []"
                    :disabled="uploading"
                    class="text-[11px] font-semibold text-red-500 outline-none hover:text-red-600 disabled:opacity-50"
                  >
                    {{ t('ล้างทั้งหมด') }}
                  </button>
                </div>
              </div>
              
              <div class="max-h-[180px] space-y-1.5 overflow-y-auto pr-1">
                <div 
                  v-for="(item, idx) in filesToUpload" 
                  :key="item.id"
                  class="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50/60 p-2 text-xs dark:border-zinc-800/80 dark:bg-zinc-900/30"
                >
                  <div class="flex items-center gap-2 text-xs">
                    <!-- File type preview/icon -->
                    <div class="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200/60 bg-white dark:border-zinc-800/60 dark:bg-zinc-950">
                      <img 
                        v-if="item.previewUrl" 
                        :src="item.previewUrl" 
                        class="size-full object-cover" 
                        alt="preview"
                      />
                      <component 
                        v-else 
                        :is="getFileTypeMeta(item.name).icon" 
                        class="size-4.5 text-zinc-500" 
                      />
                    </div>

                    <!-- File name field -->
                    <input 
                      type="text" 
                      v-model="item.name" 
                      @keypress="onFilenameKeypress"
                      :disabled="uploading"
                      class="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold text-zinc-800 outline-none focus:border-blue-500 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                      placeholder="ชื่อไฟล์"
                    />

                    <!-- Badges and details -->
                    <div class="flex shrink-0 items-center gap-1.5">
                      <span 
                        class="rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                        :class="getFileTypeMeta(item.name).color"
                      >
                        {{ getFileTypeMeta(item.name).label }}
                      </span>
                      <span class="font-mono text-[9px] text-zinc-400">{{ (item.file.size / 1024 / 1024).toFixed(2) }} MB</span>
                      <button 
                        type="button" 
                        @click="removeFile(idx)"
                        :disabled="uploading"
                        class="rounded-lg p-1 text-red-500 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/20"
                      >
                        <Trash2 class="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ZIP Configuration Option (Naming) -->
              <div class="space-y-1.5 rounded-xl border border-zinc-200/60 bg-zinc-50/40 p-3 dark:border-zinc-800/60 dark:bg-zinc-900/10">
                <label class="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {{ t('ตั้งชื่อไฟล์ ZIP ดาวน์โหลด (ไม่บังคับ)') || 'ตั้งชื่อไฟล์ ZIP ดาวน์โหลด (ไม่บังคับ)' }}
                </label>
                <div class="relative flex items-center">
                  <input 
                    type="text" 
                    v-model="customZipName"
                    @keypress="onFilenameKeypress"
                    :disabled="uploading"
                    placeholder="archive"
                    class="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 pr-10 text-xs font-semibold text-zinc-800 outline-none focus:border-blue-500 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <span class="absolute right-3 font-mono text-[10px] text-zinc-400">.zip</span>
                </div>
                <p class="text-zinc-450 text-[9px] leading-relaxed dark:text-zinc-500">
                  💡 {{ t('ช่วยให้ผู้ดาวน์โหลดได้รับชื่อไฟล์ ZIP ที่มีความหมาย แทนชื่อ UUID แบบสุ่ม') }}
                </p>
              </div>

              <!-- Size details & Upload Button -->
              <div class="flex items-center justify-between border-t border-zinc-200/60 pt-2 text-xs dark:border-zinc-800/60">
                <span class="font-semibold text-zinc-500">{{ t('ขนาดรวม') }}:</span>
                <span 
                  class="font-mono font-bold"
                  :class="filesToUpload.reduce((acc, f) => acc + f.file.size, 0) > 10 * 1024 * 1024 ? 'text-red-500' : 'text-zinc-600 dark:text-zinc-300'"
                >
                  {{ (filesToUpload.reduce((acc, f) => acc + f.file.size, 0) / 1024 / 1024).toFixed(2) }} / 10.00 MB
                </span>
              </div>

              <button 
                type="button"
                @click="handleFileUploadWorkflow"
                :disabled="uploading || filesToUpload.reduce((acc, f) => acc + f.file.size, 0) > 10 * 1024 * 1024"
                class="flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 font-bold text-white shadow-md shadow-blue-500/10 transition-all hover:bg-blue-700 active:scale-[0.99] disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                <Sparkles v-if="!uploading" class="size-4" />
                <div v-else class="size-4 animate-spin rounded-full border-2 border-zinc-300 border-t-white"></div>
                <span>{{ t('อัปโหลดไฟล์และแชร์เป็นลิงก์ QR') }}</span>
              </button>
            </div>

            <!-- Note Editor Form Toggle for Empty Queue -->
            <div v-else class="flex select-none justify-center">
              <button
                type="button"
                v-if="!showNoteEditor"
                @click="showNoteEditor = true"
                :disabled="uploading"
                class="border-zinc-250 text-zinc-650 dark:border-zinc-750 dark:text-zinc-350 flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-zinc-50 disabled:opacity-50 dark:hover:bg-zinc-800/40"
              >
                <Plus class="size-3.5 text-blue-600 dark:text-blue-400" />
                <span>{{ t('เขียนโน้ตข้อความแนบ') || 'เขียนโน้ตข้อความแนบ' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
