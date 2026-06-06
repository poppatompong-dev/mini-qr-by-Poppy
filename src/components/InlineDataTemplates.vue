<script setup lang="ts">
import { ref, watch } from 'vue'
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
  AlertCircle
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
}
const filesToUpload = ref<UploadableFile[]>([])
const uploading = ref(false)
const uploadProgress = ref('')
const uploadError = ref('')
const filesInputRef = ref<HTMLInputElement | null>(null)

// --- Helper Actions ---

const triggerFileInput = () => {
  if (uploading.value) return
  filesInputRef.value?.click()
}

const addFilesToList = (files: File[]) => {
  const mapped = files.map(file => ({
    id: window.crypto.randomUUID(),
    file,
    name: file.name
  }))
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
  filesToUpload.value.splice(index, 1)
  triggerDataGeneration()
}

const onFilenameKeypress = (event: KeyboardEvent) => {
  const illegalChars = /[\\/:*?"<>|]/
  if (illegalChars.test(event.key)) {
    event.preventDefault()
  }
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

// Upload ZIP workflow
const handleFileUploadWorkflow = async () => {
  if (!isSupabaseConfigured) {
    uploadError.value = t('Supabase credentials missing. Check your settings.')
    return
  }
  if (filesToUpload.value.length === 0) return

  uploading.value = true
  uploadError.value = ''
  uploadProgress.value = t('บีบอัดไฟล์ ZIP...') || 'Zipping files...'

  try {
    const zip = new JSZip()
    const usedNames = new Set<string>()
    const finalZipNameList: string[] = []

    const getFileExtension = (filename: string): string => {
      const parts = filename.split('.')
      return parts.length > 1 ? `.${parts.pop()}` : ''
    }

    for (const item of filesToUpload.value) {
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
      zip.file(finalName, item.file)
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const zipSize = zipBlob.size // Clean fix: Log actual ZIP size from code review

    uploadProgress.value = t('กำลังอัปโหลดไปยัง Supabase...') || 'Uploading...'

    const fileId = window.crypto.randomUUID()
    const fileName = `${fileId}.zip`

    const { error: uploadErrorDetails } = await supabase.storage
      .from('qr-files')
      .upload(fileName, zipBlob, {
        contentType: 'application/zip',
        cacheControl: '3600',
        upsert: false
      })

    if (uploadErrorDetails) throw uploadErrorDetails

    uploadProgress.value = t('อัปโหลดเสร็จสมบูรณ์!') || 'Upload complete!'

    const { data: { publicUrl } } = supabase.storage
      .from('qr-files')
      .getPublicUrl(fileName)

    // Log to DB
    const { error: dbError } = await supabase
      .from('qr_files_log')
      .insert({
        file_name: fileName,
        file_url: publicUrl,
        file_size: zipSize,
        files_list: finalZipNameList
      })

    if (dbError) {
      console.warn('Logging metadata to database failed:', dbError.message)
    }

    isUpdatingFromInside = true
    emit('update:modelValue', publicUrl)
    setTimeout(() => {
      isUpdatingFromInside = false
    }, 50)

  } catch (err: any) {
    console.error('File zip/upload failed:', err)
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
          v-model="textData"
          rows="4"
          class="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5 text-sm text-input outline-none transition-all dark:border-zinc-800 dark:bg-zinc-950/20"
          :placeholder="t('พิมพ์ข้อความที่ต้องการเข้ารหัส...')"
        ></textarea>
      </div>

      <!-- 2. URL Form -->
      <div v-if="selectedType === 'url'" class="space-y-1">
        <input
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

        <div v-else class="space-y-3">
          <!-- Dropzone area -->
          <div 
            @click="triggerFileInput"
            @dragover.prevent
            @drop.prevent="onFilesDrop"
            :class="[
              'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-200',
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
            <UploadCloud class="mb-2 size-10 text-zinc-400 dark:text-zinc-600" />
            <p class="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{{ t('เลือกไฟล์ข้อมูล หรือ ลากวางตรงนี้') }}</p>
            <p class="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">{{ t('รองรับไฟล์หลากหลายขนาดรวมกันสูงสุด 10 MB') }}</p>
          </div>

          <!-- Queue listing of chosen files -->
          <div v-if="filesToUpload.length > 0" class="space-y-2">
            <div class="flex items-center justify-between text-xs font-bold text-zinc-500">
              <span>{{ t('ไฟล์ที่เลือก') }} ({{ filesToUpload.length }})</span>
              <button 
                type="button" 
                @click="filesToUpload = []"
                :disabled="uploading"
                class="text-[11px] font-semibold text-red-500 outline-none hover:text-red-600 disabled:opacity-50"
              >
                {{ t('ล้างทั้งหมด') }}
              </button>
            </div>
            
            <div class="max-h-[160px] space-y-1.5 overflow-y-auto pr-1">
              <div 
                v-for="(item, idx) in filesToUpload" 
                :key="item.id"
                class="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50/60 p-2 text-xs dark:border-zinc-800/80 dark:bg-zinc-900/30"
              >
                <input 
                  type="text" 
                  v-model="item.name" 
                  @keypress="onFilenameKeypress"
                  :disabled="uploading"
                  class="flex-1 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-800 outline-none focus:border-blue-500 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                  placeholder="ชื่อไฟล์"
                />
                <span class="shrink-0 font-mono text-[10px] text-zinc-400">{{ (item.file.size / 1024 / 1024).toFixed(2) }} MB</span>
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
              <span>{{ uploading ? uploadProgress : (t('อัปโหลดไฟล์และแชร์เป็นลิงก์ ZIP') || 'Upload and zip link') }}</span>
            </button>
          </div>

          <!-- Error Alert -->
          <div v-if="uploadError" class="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
            <p class="font-bold">❌ {{ uploadError }}</p>
            <div class="mt-2 border-t border-red-200/60 pt-2 dark:border-red-900/30">
              <p class="mb-1 font-semibold">💡 คำแนะนำการเปิดใช้ระบบฝากไฟล์:</p>
              <ul class="list-decimal space-y-0.5 pl-4 text-[10px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                <li>เปิดหน้า Supabase Dashboard สรรสร้างพื้นที่จัดเก็บถัง (Storage Bucket) ชื่อ <code class="rounded bg-zinc-200 px-1 font-mono dark:bg-zinc-800">qr-files</code></li>
                <li>ตั้งค่า Bucket เป็นสิทธิ์ <strong class="underline">Public</strong> เพื่อดาวน์โหลดข้อมูลผ่าน QR ได้</li>
                <li>ตรวจสอบสิทธิ์เข้าถึงของนโยบายความปลอดภัย RLS ของ Bucket</li>
              </ul>
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
