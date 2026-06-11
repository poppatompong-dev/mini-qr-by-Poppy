<script setup lang="ts">
import { marked } from 'marked'
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchWithBasePath } from '@/utils/basePath'
import { useChangelogNotice } from '@/utils/useChangelogNotice'
import { getDisplayVersion } from '@/utils/changelogVersion'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from '@/components/ui/dialog'
import { X, Key } from 'lucide-vue-next'
import PromptPayModal from '@/components/PromptPayModal.vue'
import AdminHistoryModal from '@/components/AdminHistoryModal.vue'

const { t } = useI18n()
const { hasUnseenChangelog, markAsSeen } = useChangelogNotice()
const version = ref('...')
const changelogContent = ref<string | null>(null)
const isLoading = ref(true)
const hideCredits = ['1', 'true'].includes((import.meta.env.VITE_HIDE_CREDITS ?? '').toLowerCase())
const isPromptPayOpen = ref(false)
const isAdminHistoryOpen = ref(false)


async function fetchAndProcessChangelog() {
  if (changelogContent.value === null) {
    isLoading.value = true
    try {
      const response = await fetchWithBasePath('/CHANGELOG.md')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const markdown = await response.text()

      version.value = getDisplayVersion(markdown, import.meta.env.VITE_APP_VERSION)

      changelogContent.value = await marked.parse(markdown)
    } catch (error) {
      console.error('Failed to fetch or process changelog:', error)
      version.value = t('Error')
      changelogContent.value = `<p>${t('Failed to load changelog')}</p>`
    } finally {
      isLoading.value = false
    }
  }
}

onMounted(() => {
  fetchAndProcessChangelog()
})
</script>

<template>
  <footer
    v-if="!hideCredits"
    class="dark:text-zinc-455 mt-auto flex w-full select-none items-center justify-center border-t border-[var(--border-zinc)] p-5 text-xs text-zinc-500"
  >
    <div class="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-2 text-center">
      <span class="flex items-center gap-1">
        <span>{{ t('Created by') }}</span>
        <a
          href="https://www.nsm.go.th"
          target="_blank"
          class="font-bold text-[var(--text-primary)] no-underline transition-colors hover:text-[var(--accent-gold)] dark:hover:text-[var(--accent-gold)]"
        >นักวิชาการคอมพิวเตอร์ กองยุทธศาสตร์และงบประมาณ เทศบาลนครนครสวรรค์</a>
      </span>
      
      <span class="select-none font-bold text-[var(--accent-gold)]">•</span>

      <Dialog>
        <DialogTrigger as-child>
          <button
            class="relative text-xs font-bold text-zinc-500 outline-none transition-colors duration-300 hover:text-[var(--accent-gold)] dark:text-zinc-400 dark:hover:text-[var(--accent-gold)]"
            :aria-label="t('View changelog')"
            :disabled="isLoading"
            @click="markAsSeen"
          >
            {{ isLoading ? '...' : version }}
            <span
              v-if="hasUnseenChangelog"
              class="absolute -right-1.5 -top-1.5 block size-1.5 rounded-full bg-[var(--accent-gold)] ring-1 ring-white dark:ring-zinc-900"
              aria-hidden="true"
            ></span>
          </button>
        </DialogTrigger>
        <DialogContent class="flex max-h-[80vh] flex-col border-[var(--border-zinc)] bg-white dark:bg-zinc-950 sm:max-w-md" @open-auto-focus.prevent>
          <DialogHeader>
            <DialogTitle class="text-base font-bold text-[var(--text-primary)]">{{ t('Changelog') }}</DialogTitle>
            <DialogClose
              class="absolute right-4 top-4 rounded-xl opacity-70 outline-none transition-opacity hover:opacity-100 focus:outline-none"
            >
              <X class="size-4 text-[var(--text-primary)]" />
              <span class="sr-only">{{ t('Close') }}</span>
            </DialogClose>
          </DialogHeader>

          <div class="flex-1 overflow-y-auto pe-2">
            <DialogDescription
              as="div"
              class="text-zinc-650 prose prose-sm max-w-none text-start dark:prose-invert prose-li:my-1 dark:text-zinc-400"
            >
              <div v-if="isLoading">Loading...</div>
              <div v-else-if="changelogContent" v-html="changelogContent"></div>
              <div v-else>{{ t('Failed to load changelog') }}</div>
            </DialogDescription>
          </div>
        </DialogContent>
      </Dialog>

      <span class="select-none font-bold text-[var(--accent-gold)]">•</span>

      <button
        class="text-xs font-bold text-zinc-500 outline-none transition-colors duration-300 hover:text-[var(--accent-gold)] dark:text-zinc-400 dark:hover:text-[var(--accent-gold)]"
        :aria-label="t('Sponsor')"
        @click="isPromptPayOpen = true"
      >{{ t('Sponsor') }}</button>

      <span class="select-none font-bold text-[var(--accent-gold)]">•</span>

      <button
        @click="isAdminHistoryOpen = true"
        class="flex items-center gap-1 text-xs font-bold text-zinc-500 outline-none transition-all duration-300 hover:text-[var(--accent-gold)] dark:text-zinc-400 dark:hover:text-[var(--accent-gold)]"
        :title="t('ระบบจัดการไฟล์ผู้ดูแลระบบ') || 'ระบบจัดการไฟล์ผู้ดูแลระบบ'"
      >
        <Key class="size-3.5" />
        <span>{{ t('ระบบแอดมิน') || 'ระบบแอดมิน' }}</span>
      </button>
    </div>
  </footer>
  <PromptPayModal v-model:open="isPromptPayOpen" />
  <AdminHistoryModal :open="isAdminHistoryOpen" @close="isAdminHistoryOpen = false" />
</template>

<style scoped>
footer {
  background: var(--bg-card);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
</style>
