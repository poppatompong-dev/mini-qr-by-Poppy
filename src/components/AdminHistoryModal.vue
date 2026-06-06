<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { supabase, isSupabaseConfigured } from '@/utils/supabase'
import { 
  Lock, 
  Unlock, 
  Trash2, 
  Copy, 
  Download, 
  X, 
  Calendar, 
  FileArchive, 
  HardDrive,
  CheckCircle,
  AlertCircle
} from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
}>()

defineEmits(['close'])

const { t } = useI18n()

// Auth state
const password = ref('')
const isAuthenticated = ref(false)
const authError = ref(false)

// History logs state
const logs = ref<any[]>([])
const loading = ref(false)
const dbError = ref('')
const copySuccessId = ref<string | null>(null)

// Reset state on open/close
watch(() => props.open, (newVal) => {
  if (!newVal) {
    password.value = ''
    isAuthenticated.value = false
    authError.value = false
    logs.value = []
  }
})

const handleLogin = () => {
  const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || '@dm!nP0p'
  if (password.value === adminPassword) {
    isAuthenticated.value = true
    authError.value = false
    fetchHistoryLogs()
  } else {
    authError.value = true
    password.value = ''
  }
}

const fetchHistoryLogs = async () => {
  if (!isSupabaseConfigured) {
    dbError.value = 'Supabase credentials are not configured in your .env file.'
    return
  }
  loading.value = true
  dbError.value = ''
  try {
    const { data, error } = await supabase
      .from('qr_files_log')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    logs.value = data || []
  } catch (err: any) {
    console.error('Database fetch error:', err)
    dbError.value = err.message || 'Failed to connect to qr_files_log table.'
  } finally {
    loading.value = false
  }
}

const handleCopy = async (id: string, text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    copySuccessId.value = id
    setTimeout(() => {
      copySuccessId.value = null
    }, 2000)
  } catch (err) {
    console.error('Failed to copy', err)
  }
}

const handleDelete = async (row: any) => {
  if (!isSupabaseConfigured) return
  const confirmMsg = t('คุณแน่ใจหรือไม่ที่จะลบประวัติและไฟล์นี้ออกจากระบบ?') || 'Are you sure you want to delete this log and storage file?'
  if (!window.confirm(confirmMsg)) return

  try {
    // 1. Delete from Supabase Storage
    const { error: storageError } = await supabase.storage
      .from('qr-files')
      .remove([row.file_name])

    if (storageError) {
      console.warn('Storage file deletion error (could be already deleted):', storageError.message)
    }

    // 2. Delete from Supabase Database
    const { error: dbDeleteError } = await supabase
      .from('qr_files_log')
      .delete()
      .eq('id', row.id)

    if (dbDeleteError) throw dbDeleteError

    // 3. Refresh list
    logs.value = logs.value.filter(item => item.id !== row.id)
  } catch (err: any) {
    window.alert(err.message || 'Deletion failed.')
  }
}

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(2)} MB`
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  return d.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <div 
    v-if="open" 
    class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    @click.self="$emit('close')"
  >
    <!-- Modal Container -->
    <div class="glass-card flex max-h-[85vh] w-[95%] max-w-4xl flex-col overflow-hidden bg-white p-6 text-zinc-800 shadow-2xl dark:bg-zinc-900 dark:text-zinc-100">
      <!-- Modal Header -->
      <div class="flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <h2 class="flex items-center gap-2 text-lg font-bold">
          <HardDrive class="size-5 text-blue-600 dark:text-blue-400" />
          <span>{{ t('ระบบจัดการไฟล์ผู้ดูแลระบบ') || 'ระบบจัดการไฟล์ผู้ดูแลระบบ' }}</span>
        </h2>
        <button 
          @click="$emit('close')" 
          class="rounded-lg p-1.5 text-zinc-500 outline-none transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800"
        >
          <X class="size-5" />
        </button>
      </div>

      <!-- Content Area -->
      <div class="flex-1 overflow-y-auto py-6">
        
        <!-- 1. Password Gate -->
        <div v-if="!isAuthenticated" class="mx-auto max-w-sm py-8 text-center">
          <div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/50">
            <Lock class="size-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 class="mb-1 text-base font-bold">{{ t('ต้องการรหัสผ่านเพื่อเข้าใช้งาน') || 'ต้องการรหัสผ่านเพื่อเข้าใช้งาน' }}</h3>
          <p class="mb-6 text-xs text-zinc-500 dark:text-zinc-400">{{ t('กรุณาระบุรหัสผ่านเข้าสู่ระบบหลังบ้านแอดมิน') || 'กรุณาระบุรหัสผ่านเข้าสู่ระบบหลังบ้านแอดมิน' }}</p>
          
          <form @submit.prevent="handleLogin" class="space-y-4">
            <input 
              type="password" 
              v-model="password"
              placeholder="••••••••"
              class="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-center font-mono text-sm text-zinc-800 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-blue-500"
              required
              autofocus
            />
            <button 
              type="submit" 
              class="w-full rounded-xl bg-blue-600 py-2 font-semibold text-white shadow-md shadow-blue-500/10 outline-none transition-all hover:bg-blue-700 active:scale-[0.98]"
            >
              {{ t('ยืนยันรหัสผ่าน') || 'ยืนยันรหัสผ่าน' }}
            </button>
            <p v-if="authError" class="mt-2 animate-pulse text-xs font-semibold text-red-500">
              ⚠️ {{ t('รหัสผ่านไม่ถูกต้อง กรุณาลองอีกครั้ง') || 'รหัสผ่านไม่ถูกต้อง กรุณาลองอีกครั้ง' }}
            </p>
          </form>
        </div>

        <!-- 2. Authenticated Admin View -->
        <div v-else class="flex h-full flex-col space-y-4">
          
          <!-- Database Table Check Error -->
          <div v-if="dbError" class="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400">
            <AlertCircle class="size-5 shrink-0" />
            <div>
              <p class="mb-1 font-bold">⚠️ ยังไม่ได้สร้างตารางประวัติในฐานข้อมูล</p>
              <p class="mb-2 leading-relaxed">ตรวจพบล็อกไม่ทำงานเนื่องจากตาราง <code class="rounded bg-amber-100 px-1 py-0.5 font-mono dark:bg-amber-900/40">qr_files_log</code> ยังไม่ได้ถูกสร้างขึ้นใน Supabase Dashboard ของคุณ</p>
              <p class="mb-1 font-semibold">วิธีการเปิดใช้งาน:</p>
              <p class="leading-relaxed">โปรดนำคำสั่ง SQL ในคู่มือการพัฒนาไปติดตั้งผ่านหน้าจอ SQL Editor ของ Supabase เพื่อรองรับการบันทึกประวัติการสร้างไฟล์ลงฐานข้อมูลกลาง</p>
            </div>
          </div>

          <!-- Loading state -->
          <div v-if="loading" class="flex flex-col items-center justify-center py-20">
            <div class="size-8 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-600 dark:border-zinc-800 dark:border-t-blue-400"></div>
            <p class="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{{ t('กำลังโหลดประวัติการสร้างไฟล์...') || 'กำลังโหลดประวัติการสร้างไฟล์...' }}</p>
          </div>

          <!-- Empty state -->
          <div v-else-if="logs.length === 0" class="flex flex-col items-center justify-center py-20 text-center text-zinc-400 dark:text-zinc-500">
            <div class="mb-3 rounded-full bg-zinc-50 p-3 dark:bg-zinc-800/40">
              <Unlock class="size-6 text-zinc-400 dark:text-zinc-500" />
            </div>
            <p class="text-sm font-semibold">{{ t('ไม่พบประวัติการอัปโหลดไฟล์') || 'ไม่พบประวัติการอัปโหลดไฟล์' }}</p>
            <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-500">{{ t('เมื่อมีผู้ใช้งานอัปโหลดไฟล์สำเร็จ รายการจะแสดงขึ้นที่นี่') || 'เมื่อมีผู้ใช้งานอัปโหลดไฟล์สำเร็จ รายการจะแสดงขึ้นที่นี่' }}</p>
          </div>

          <!-- Logs Table -->
          <div v-else class="flex-1 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table class="w-full border-collapse text-left text-xs text-zinc-600 dark:text-zinc-300">
              <thead class="select-none border-b border-zinc-200 bg-zinc-50 font-semibold uppercase tracking-wider text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-200">
                <tr>
                  <th class="px-4 py-3">{{ t('วันที่สร้าง') || 'วันที่สร้าง' }}</th>
                  <th class="px-4 py-3">{{ t('ลิงก์ ZIP / ขนาด') || 'ลิงก์ ZIP / ขนาด' }}</th>
                  <th class="px-4 py-3">{{ t('รายการไฟล์ภายใน') || 'รายการไฟล์ภายใน' }}</th>
                  <th class="px-4 py-3 text-center">{{ t('การจัดการ') || 'การจัดการ' }}</th>
                </tr>
              </thead>
              <tbody class="dark:divide-zinc-850 divide-y divide-zinc-200">
                <tr 
                  v-for="row in logs" 
                  :key="row.id"
                  class="transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30"
                >
                  <!-- Date -->
                  <td class="shrink-0 px-4 py-3.5 font-medium">
                    <div class="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200">
                      <Calendar class="size-3.5 text-zinc-400" />
                      <span>{{ formatDate(row.created_at) }}</span>
                    </div>
                  </td>
                  
                  <!-- Link & Size -->
                  <td class="max-w-[240px] px-4 py-3.5">
                    <div class="flex flex-col gap-1.5">
                      <div class="flex w-full items-center gap-1">
                        <span class="max-w-[140px] truncate rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" :title="row.file_url">{{ row.file_name }}</span>
                        <!-- Download button -->
                        <a 
                          :href="row.file_url" 
                          target="_blank"
                          class="rounded p-1 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                          title="ดาวน์โหลดไฟล์ ZIP"
                        >
                          <Download class="size-3.5" />
                        </a>
                        <!-- Copy link button -->
                        <button 
                          @click="handleCopy(row.id, row.file_url)"
                          class="hover:text-zinc-850 relative rounded p-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                          title="คัดลอกลิงก์ไฟล์"
                        >
                          <CheckCircle v-if="copySuccessId === row.id" class="animate-scale size-3.5 text-emerald-500" />
                          <Copy v-else class="size-3.5" />
                        </button>
                      </div>
                      <div class="flex items-center gap-1 font-mono text-[11px] text-zinc-400">
                        <FileArchive class="size-3" />
                        <span>{{ formatSize(row.file_size) }}</span>
                      </div>
                    </div>
                  </td>

                  <!-- Files inside Zip -->
                  <td class="max-w-[320px] px-4 py-3.5">
                    <div class="flex flex-wrap gap-1">
                      <span 
                        v-for="(name, index) in row.files_list" 
                        :key="index"
                        class="max-w-[120px] truncate rounded border border-blue-100/30 bg-blue-50/60 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-950/20 dark:text-blue-400"
                        :title="name"
                      >
                        {{ name }}
                      </span>
                    </div>
                  </td>

                  <!-- Actions -->
                  <td class="shrink-0 px-4 py-3.5 text-center">
                    <button 
                      @click="handleDelete(row)"
                      class="inline-flex items-center gap-1 rounded-lg border border-red-200 p-1.5 text-[11px] font-semibold text-red-500 outline-none transition-all hover:border-red-500 hover:bg-red-500 hover:text-white dark:border-red-900/40 dark:hover:bg-red-600"
                    >
                      <Trash2 class="size-3.5" />
                      <span>{{ t('ลบ') || 'ลบ' }}</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="flex justify-end pt-2 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">
            🔑 {{ t('ผู้ดูแลระบบเป็นคนเดียวที่มีสิทธิ์เข้าถึงส่วนงานนี้') || 'ผู้ดูแลระบบเป็นคนเดียวที่มีสิทธิ์เข้าถึงส่วนงานนี้' }}
          </div>

        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes scale {
  0% { transform: scale(0.8); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}
.animate-scale {
  animation: scale 0.2s ease-in-out;
}
</style>
