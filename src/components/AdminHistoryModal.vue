<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { isSupabaseConfigured } from '@/utils/supabase'
import { adminInvoke, ShareApiError, type AdminShareRecord } from '@/utils/shareApi'
import { mapShareErrorMessage } from '@/utils/fileShareValidation'
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
  AlertCircle,
  Clock,
  QrCode
} from 'lucide-vue-next'
import { downloadPngElement } from '@/utils/convertToImage'
import StyledQRCode from '@/components/StyledQRCode.vue'

const props = defineProps<{
  open: boolean
}>()

defineEmits(['close'])

const { t } = useI18n()

// Auth state. The admin secret is held in memory only for the duration of the
// session and is sent to the admin-shares Edge Function on every request via
// the x-admin-secret header. It is NEVER persisted or bundled into the client.
const adminSecret = ref('')
const isAuthenticated = ref(false)
const authError = ref('')
const authLoading = ref(false)

// History logs state
const logs = ref<AdminShareRecord[]>([])
const loading = ref(false)
const dbError = ref('')
const copySuccessId = ref<string | null>(null)

// QR Code preview state
const selectedQrRow = ref<AdminShareRecord | null>(null)

// Reset state on open/close
watch(
  () => props.open,
  (newVal) => {
    if (!newVal) {
      adminSecret.value = ''
      isAuthenticated.value = false
      authError.value = ''
      logs.value = []
      selectedQrRow.value = null
    }
  }
)

const handleLogin = async () => {
  if (!isSupabaseConfigured) {
    authError.value = t('ยังไม่ได้ตั้งค่าระบบฝากไฟล์ Supabase สำหรับเว็บไซต์นี้')
    return
  }
  if (!adminSecret.value.trim()) return
  authLoading.value = true
  authError.value = ''
  try {
    const result = await adminInvoke<{ shares: AdminShareRecord[] }>('list', adminSecret.value)
    logs.value = result.shares || []
    isAuthenticated.value = true
  } catch (err: unknown) {
    if (err instanceof ShareApiError) {
      authError.value = mapShareErrorMessage(err.code) || err.message
    } else {
      authError.value = t('เข้าสู่ระบบล้มเหลว กรุณาลองใหม่อีกครั้ง')
    }
    adminSecret.value = ''
  } finally {
    authLoading.value = false
  }
}

const fetchHistoryLogs = async () => {
  loading.value = true
  dbError.value = ''
  try {
    const result = await adminInvoke<{ shares: AdminShareRecord[] }>('list', adminSecret.value)
    logs.value = result.shares || []
  } catch (err: unknown) {
    console.error('Admin list error:', err)
    dbError.value =
      err instanceof ShareApiError
        ? mapShareErrorMessage(err.code) || err.message
        : 'Failed to load shares.'
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

const handleDelete = async (row: AdminShareRecord) => {
  const confirmMsg =
    t('คุณแน่ใจหรือไม่ที่จะลบประวัติและไฟล์นี้ออกจากระบบ?') ||
    'Are you sure you want to delete this log and storage file?'
  if (!window.confirm(confirmMsg)) return

  try {
    // The Edge Function (service role) removes BOTH the storage objects and
    // the metadata row, then writes an audit entry.
    await adminInvoke('delete', adminSecret.value, row.id)
    logs.value = logs.value.filter((item) => item.id !== row.id)
  } catch (err: unknown) {
    window.alert(
      err instanceof ShareApiError
        ? mapShareErrorMessage(err.code) || err.message
        : 'Deletion failed.'
    )
  }
}

const handleExpire = async (row: AdminShareRecord) => {
  const confirmMsg =
    t('ต้องการทำให้ลิงก์นี้หมดอายุทันทีหรือไม่? ผู้ใช้จะดาวน์โหลดไม่ได้อีก') ||
    'Expire this share now? It will no longer be downloadable.'
  if (!window.confirm(confirmMsg)) return

  try {
    await adminInvoke('expire', adminSecret.value, row.id)
    const target = logs.value.find((item) => item.id === row.id)
    if (target) {
      target.status = 'expired'
      target.expires_at = new Date().toISOString()
    }
  } catch (err: unknown) {
    window.alert(
      err instanceof ShareApiError
        ? mapShareErrorMessage(err.code) || err.message
        : 'Expire failed.'
    )
  }
}

const isExpired = (row: AdminShareRecord): boolean => {
  if (row.status === 'expired' || row.status === 'deleted') return true
  return !!row.expires_at && new Date(row.expires_at).getTime() <= Date.now()
}

const downloadAdminQR = async () => {
  if (!selectedQrRow.value || !selectedQrRow.value.file_url) return
  const filename = `${selectedQrRow.value.file_name.replace('.zip', '')}-qr-code`
  const exportInput = {
    options: {
      data: selectedQrRow.value.file_url,
      width: 400,
      height: 400,
      type: 'svg' as const,
      dotsOptions: {
        color: '#1e40af',
        type: 'rounded' as const
      },
      cornersSquareOptions: {
        color: '#1d4ed8',
        type: 'extra-rounded' as const
      },
      cornersDotOptions: {
        color: '#1e40af',
        type: 'dot' as const
      }
    },
    size: { width: 400, height: 400 }
  }
  await downloadPngElement(exportInput, filename)
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
    <div
      class="glass-card flex max-h-[85vh] w-[95%] max-w-4xl flex-col overflow-hidden bg-white p-6 text-zinc-800 shadow-2xl dark:bg-zinc-900 dark:text-zinc-100"
    >
      <!-- Modal Header -->
      <div
        class="flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800"
      >
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
          <div
            class="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/50"
          >
            <Lock class="size-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 class="mb-1 text-base font-bold">
            {{
              t('ต้องการรหัสผู้ดูแลระบบเพื่อเข้าใช้งาน') || 'ต้องการรหัสผู้ดูแลระบบเพื่อเข้าใช้งาน'
            }}
          </h3>
          <p class="mb-6 text-xs text-zinc-500 dark:text-zinc-400">
            {{
              t('รหัสนี้ถูกตรวจสอบที่เซิร์ฟเวอร์ (Edge Function) และไม่ถูกเก็บไว้ในเบราว์เซอร์') ||
              'รหัสนี้ถูกตรวจสอบที่เซิร์ฟเวอร์ (Edge Function) และไม่ถูกเก็บไว้ในเบราว์เซอร์'
            }}
          </p>

          <form @submit.prevent="handleLogin" class="space-y-4">
            <input
              type="password"
              v-model="adminSecret"
              :disabled="authLoading"
              placeholder="••••••••"
              class="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-center font-mono text-sm text-zinc-800 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-blue-500"
              required
              autofocus
            />
            <button
              type="submit"
              :disabled="authLoading || !adminSecret.trim()"
              class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2 font-semibold text-white shadow-md shadow-blue-500/10 outline-none transition-all hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div
                v-if="authLoading"
                class="size-4 animate-spin rounded-full border-2 border-blue-200 border-t-white"
              ></div>
              <span>{{
                authLoading
                  ? t('กำลังตรวจสอบ...') || 'กำลังตรวจสอบ...'
                  : t('เข้าสู่ระบบผู้ดูแล') || 'เข้าสู่ระบบผู้ดูแล'
              }}</span>
            </button>
            <p v-if="authError" class="mt-2 animate-pulse text-xs font-semibold text-red-500">
              ⚠️ {{ authError }}
            </p>
          </form>
        </div>

        <!-- 2. Authenticated Admin View -->
        <div v-else class="flex h-full flex-col space-y-4">
          <!-- Toolbar -->
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              {{ t('รายการประวัติทั้งหมดในระบบ') || 'รายการประวัติทั้งหมดในระบบ' }} ({{
                logs.length
              }})
            </span>
            <button
              @click="fetchHistoryLogs"
              :disabled="loading"
              class="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 outline-none transition-all hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Clock class="size-4" />
              <span>{{ t('รีเฟรชรายการ') || 'รีเฟรชรายการ' }}</span>
            </button>
          </div>

          <!-- Database Table Check Error -->
          <div
            v-if="dbError"
            class="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400"
          >
            <AlertCircle class="size-5 shrink-0" />
            <div>
              <p class="mb-1 font-bold">⚠️ ยังไม่ได้สร้างตารางประวัติในฐานข้อมูล</p>
              <p class="mb-2 leading-relaxed">
                ตรวจพบล็อกไม่ทำงานเนื่องจากตาราง
                <code class="rounded bg-amber-100 px-1 py-0.5 font-mono dark:bg-amber-900/40"
                  >qr_files_log</code
                >
                ยังไม่ได้ถูกสร้างขึ้นใน Supabase Dashboard ของคุณ
              </p>
              <p class="mb-1 font-semibold">วิธีการเปิดใช้งาน:</p>
              <p class="leading-relaxed">
                โปรดนำคำสั่ง SQL ในคู่มือการพัฒนาไปติดตั้งผ่านหน้าจอ SQL Editor ของ Supabase
                เพื่อรองรับการบันทึกประวัติการสร้างไฟล์ลงฐานข้อมูลกลาง
              </p>
            </div>
          </div>

          <!-- Loading state -->
          <div v-if="loading" class="flex flex-col items-center justify-center py-20">
            <div
              class="size-8 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-600 dark:border-zinc-800 dark:border-t-blue-400"
            ></div>
            <p class="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              {{ t('กำลังโหลดประวัติการสร้างไฟล์...') || 'กำลังโหลดประวัติการสร้างไฟล์...' }}
            </p>
          </div>

          <!-- Empty state -->
          <div
            v-else-if="logs.length === 0"
            class="flex flex-col items-center justify-center py-20 text-center text-zinc-400 dark:text-zinc-500"
          >
            <div class="mb-3 rounded-full bg-zinc-50 p-3 dark:bg-zinc-800/40">
              <Unlock class="size-6 text-zinc-400 dark:text-zinc-500" />
            </div>
            <p class="text-sm font-semibold">
              {{ t('ไม่พบประวัติการอัปโหลดไฟล์') || 'ไม่พบประวัติการอัปโหลดไฟล์' }}
            </p>
            <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
              {{
                t('เมื่อมีผู้ใช้งานอัปโหลดไฟล์สำเร็จ รายการจะแสดงขึ้นที่นี่') ||
                'เมื่อมีผู้ใช้งานอัปโหลดไฟล์สำเร็จ รายการจะแสดงขึ้นที่นี่'
              }}
            </p>
          </div>

          <!-- Logs Table -->
          <div
            v-else
            class="flex-1 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800"
          >
            <table
              class="w-full border-collapse text-left text-xs text-zinc-600 dark:text-zinc-300"
            >
              <thead
                class="select-none border-b border-zinc-200 bg-zinc-50 font-semibold uppercase tracking-wider text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-200"
              >
                <tr>
                  <th class="px-4 py-3">{{ t('วันที่สร้าง') || 'วันที่สร้าง' }}</th>
                  <th class="px-4 py-3">{{ t('ลิงก์ ZIP / ขนาด') || 'ลิงก์ ZIP / ขนาด' }}</th>
                  <th class="px-4 py-3">{{ t('สถานะ') || 'สถานะ' }}</th>
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
                        <span
                          class="max-w-[140px] truncate rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          :title="row.file_url || row.file_name"
                          >{{ row.file_name }}</span
                        >
                        <!-- Download button -->
                        <a
                          v-if="row.file_url"
                          :href="row.file_url"
                          target="_blank"
                          class="rounded p-1 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                          title="เปิดหน้าดาวน์โหลด"
                        >
                          <Download class="size-3.5" />
                        </a>
                        <!-- Copy link button -->
                        <button
                          v-if="row.file_url"
                          @click="handleCopy(row.id, row.file_url)"
                          class="hover:text-zinc-850 relative rounded p-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                          title="คัดลอกลิงก์ไฟล์"
                        >
                          <CheckCircle
                            v-if="copySuccessId === row.id"
                            class="animate-scale size-3.5 text-emerald-500"
                          />
                          <Copy v-else class="size-3.5" />
                        </button>
                      </div>
                      <div class="flex items-center gap-1 font-mono text-[11px] text-zinc-400">
                        <FileArchive class="size-3" />
                        <span>{{ formatSize(row.file_size) }}</span>
                      </div>
                    </div>
                  </td>

                  <!-- Status -->
                  <td class="px-4 py-3.5">
                    <span
                      class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                      :class="
                        isExpired(row)
                          ? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                          : row.status === 'ready'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                      "
                    >
                      {{ isExpired(row) ? t('หมดอายุ') || 'หมดอายุ' : row.status }}
                    </span>
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
                    <div class="flex items-center justify-center gap-2">
                      <button
                        @click="selectedQrRow = row"
                        class="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1.5 text-[11px] font-semibold text-zinc-700 outline-none transition-all hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        title="ดูคิวอาร์โค้ด"
                      >
                        <QrCode class="size-3.5" />
                        <span>{{ t('คิวอาร์') || 'คิวอาร์' }}</span>
                      </button>
                      <button
                        v-if="!isExpired(row)"
                        @click="handleExpire(row)"
                        class="inline-flex items-center gap-1 rounded-lg border border-amber-200 p-1.5 text-[11px] font-semibold text-amber-600 outline-none transition-all hover:border-amber-500 hover:bg-amber-500 hover:text-white dark:border-amber-900/40 dark:hover:bg-amber-600"
                        title="ทำให้หมดอายุทันที"
                      >
                        <Clock class="size-3.5" />
                        <span>{{ t('หมดอายุ') || 'หมดอายุ' }}</span>
                      </button>
                      <button
                        @click="handleDelete(row)"
                        class="inline-flex items-center gap-1 rounded-lg border border-red-200 p-1.5 text-[11px] font-semibold text-red-500 outline-none transition-all hover:border-red-500 hover:bg-red-500 hover:text-white dark:border-red-900/40 dark:hover:bg-red-600"
                      >
                        <Trash2 class="size-3.5" />
                        <span>{{ t('ลบ') || 'ลบ' }}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div
            class="flex justify-end pt-2 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500"
          >
            🔑
            {{
              t('ผู้ดูแลระบบเป็นคนเดียวที่มีสิทธิ์เข้าถึงส่วนงานนี้') ||
              'ผู้ดูแลระบบเป็นคนเดียวที่มีสิทธิ์เข้าถึงส่วนงานนี้'
            }}
          </div>
        </div>
      </div>
    </div>

    <!-- 3. QR Code Preview Modal (Nested) -->
    <div
      v-if="selectedQrRow"
      class="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="selectedQrRow = null"
    >
      <div
        class="glass-card flex w-[90%] max-w-sm flex-col items-center bg-white p-6 shadow-2xl dark:bg-zinc-900 dark:text-zinc-100"
      >
        <div
          class="mb-4 flex w-full items-center justify-between border-b border-zinc-200 pb-2 dark:border-zinc-800"
        >
          <h3 class="text-sm font-bold text-zinc-800 dark:text-zinc-100">
            {{ t('คิวอาร์โค้ดสำหรับไฟล์') || 'คิวอาร์โค้ดสำหรับไฟล์' }}
          </h3>
          <button
            @click="selectedQrRow = null"
            class="dark:hover:bg-zinc-850 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X class="size-4" />
          </button>
        </div>

        <!-- QR Code Container for Image Generation -->
        <div id="admin-qr-preview-container" class="rounded-xl bg-white p-4 shadow-sm">
          <StyledQRCode
            :data="selectedQrRow.file_url || ''"
            :width="200"
            :height="200"
            dots-type="rounded"
            dots-color="#1e40af"
          />
        </div>

        <p
          class="mt-3 max-w-xs truncate text-center text-xs font-medium text-zinc-500 dark:text-zinc-400"
        >
          {{ selectedQrRow.file_name }}
        </p>

        <div class="mt-6 flex w-full gap-3">
          <button
            @click="selectedQrRow = null"
            class="dark:hover:bg-zinc-850 flex-1 rounded-xl border border-zinc-200 py-2.5 text-xs font-semibold text-zinc-700 outline-none transition-all hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
          >
            {{ t('ปิด') || 'ปิด' }}
          </button>
          <button
            @click="downloadAdminQR"
            class="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-500/10 outline-none transition-all hover:bg-blue-700"
          >
            <Download class="size-4" />
            <span>{{ t('ดาวน์โหลด') || 'ดาวน์โหลด' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes scale {
  0% {
    transform: scale(0.8);
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}
.animate-scale {
  animation: scale 0.2s ease-in-out;
}
</style>
