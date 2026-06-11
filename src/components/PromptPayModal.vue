<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import StyledQRCode from '@/components/StyledQRCode.vue'
import { generatePromptPayPayload } from '@/utils/promptpay'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose
} from '@/components/ui/dialog'
import { X, Heart, ShieldCheck } from 'lucide-vue-next'

import type { DotType, CornerSquareType, CornerDotType } from '@/lib/qr-code'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
}>()

const { t } = useI18n()

const PROMPTPAY_ID = '0836870393'
const ACCOUNT_NAME = 'ปฐมพงษ์ หล้ามเหศักดิ์'

const amount = ref<number | undefined>(undefined)
const isCopied = ref(false)

const promptPayPayload = computed(() => {
  return generatePromptPayPayload(PROMPTPAY_ID, amount.value)
})

const qrOptions = computed(() => ({
  data: promptPayPayload.value,
  width: 240,
  height: 240,
  margin: 2,
  dotsOptions: {
    color: '#2e1065', // Deep Purple
    type: 'rounded' as DotType
  },
  cornersSquareOptions: {
    color: '#b45309', // Luxury Gold/Amber
    type: 'extra-rounded' as CornerSquareType
  },
  cornersDotOptions: {
    color: '#2e1065',
    type: 'dot' as CornerDotType
  }
}))

function handleOpenChange(val: boolean) {
  emit('update:open', val)
}

function copyPromptPayId() {
  navigator.clipboard.writeText(PROMPTPAY_ID)
  isCopied.value = true
  setTimeout(() => {
    isCopied.value = false
  }, 2000)
}
</script>

<template>
  <Dialog :open="open" @update:open="handleOpenChange">
    <DialogContent class="flex max-h-[90vh] flex-col sm:max-w-md" @open-auto-focus.prevent>
      <DialogHeader class="relative border-b border-zinc-100 pb-4 dark:border-zinc-800">
        <DialogTitle class="flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">
          <Heart class="size-5 animate-pulse fill-red-500 text-red-500" />
          {{ t('สนับสนุนผู้พัฒนา') || 'สนับสนุนผู้พัฒนา' }}
        </DialogTitle>
        <DialogDescription class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {{ t('คุณสามารถสนับสนุนนักวิชาการคอมพิวเตอร์ เทศบาลนครนครสวรรค์ ได้ที่นี่') || 'คุณสามารถสนับสนุนนักวิชาการคอมพิวเตอร์ เทศบาลนครนครสวรรค์ ได้ที่นี่' }}
        </DialogDescription>
        <DialogClose
          class="absolute right-0 top-0 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none"
        >
          <X class="size-4 text-zinc-500" />
          <span class="sr-only">{{ t('Close') }}</span>
        </DialogClose>
      </DialogHeader>

      <div class="flex flex-1 flex-col items-center overflow-y-auto py-6">
        <!-- PromptPay Header Card -->
        <div class="border-[var(--accent-gold)]/40 mb-6 flex w-full max-w-[280px] flex-col items-center justify-between rounded-2xl border bg-gradient-to-br from-[#2e1065] via-[#3b0764] to-[#5b21b6] p-4 text-white shadow-lg">
          <div class="mb-2 flex w-full items-center justify-between border-b border-white/20 pb-2">
            <span class="text-xs font-semibold tracking-wider opacity-90">พร้อมเพย์ PromptPay</span>
            <ShieldCheck class="size-4 text-[var(--accent-gold)]" />
          </div>
          <div class="text-center">
            <p class="text-[10px] !text-white/70">ชื่อบัญชี / Account Name</p>
            <p class="max-w-[240px] truncate text-sm font-bold tracking-wide !text-white">{{ ACCOUNT_NAME }}</p>
          </div>
          <div class="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2">
            <span class="font-mono text-base font-bold tracking-widest text-[var(--accent-gold)]">083-687-0393</span>
            <button 
              @click="copyPromptPayId" 
              class="hover:bg-zinc-150 rounded-lg bg-white px-2 py-1 text-[10px] font-bold text-[#2e1065] shadow-sm transition-all active:scale-95"
            >
              {{ isCopied ? 'คัดลอกแล้ว' : 'คัดลอก' }}
            </button>
          </div>
        </div>

        <!-- QR Code Frame with PromptPay Branding -->
        <div class="border-[var(--accent-gold)]/30 relative flex flex-col items-center rounded-2xl border bg-zinc-50/50 p-4 shadow-sm dark:bg-zinc-900/30">
          <div class="mb-3 flex w-full justify-center">
            <!-- Dynamic PromptPay Logo Header -->
            <div class="border-[var(--accent-gold)]/30 flex items-center gap-1 rounded-full border bg-[#2e1065] px-4 py-1.5 text-xs font-bold text-white shadow-md">
              <span class="text-[var(--accent-gold)]">พร้อมเพย์</span> PromptPay
            </div>
          </div>
          
          <div class="rounded-xl border border-zinc-100 bg-white p-2.5 shadow-md">
            <StyledQRCode v-bind="qrOptions" />
          </div>
 
          <div class="mt-3.5 max-w-[240px] text-center text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
            สแกนด้วยแอปพลิเคชันธนาคารเพื่อโอนเงินสนับสนุน
          </div>
        </div>

        <!-- Optional Amount Input -->
        <div class="mt-6 w-full max-w-[280px]">
          <label for="donation-amount" class="!text-zinc-550 mb-1.5 block text-center !text-xs !font-semibold dark:!text-zinc-400">
            ระบุจำนวนเงินสนับสนุน (บาท) - ไม่บังคับ
          </label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-zinc-400 dark:text-zinc-500">฿</span>
            <input
              id="donation-amount"
              type="number"
              min="1"
              step="any"
              placeholder="ตามความสมัครใจ"
              v-model.number="amount"
              class="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2 pl-8 pr-3 text-center text-sm text-zinc-900 outline-none transition-all focus:ring-2 focus:ring-[#005D95] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-600"
            />
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.DialogContent {
  animation: modalShow 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalShow {
  from {
    opacity: 0;
    transform: translate(-50%, -48%) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}
</style>
