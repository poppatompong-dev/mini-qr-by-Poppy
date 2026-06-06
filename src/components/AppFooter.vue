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
    class="mt-auto flex w-full select-none items-center justify-center border-t border-[var(--border-zinc)] p-4 text-xs text-zinc-500 dark:text-zinc-400"
  >
    <div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center">
      <span>
        {{ t('Created by') }}
        <a
          href="https://www.nsm.go.th"
          target="_blank"
          class="ml-0.5 font-semibold text-zinc-800 no-underline transition-colors hover:text-blue-600 hover:underline dark:text-zinc-200 dark:hover:text-blue-400"
        >นักวิชาการคอมพิวเตอร์ เทศบาลนครนครสวรรค์</a>
      </span>
      
      <span class="dark:text-zinc-750 select-none text-zinc-300">•</span>

      <a
        href="https://github.com/lyqht/mini-qr"
        target="_blank"
        class="inline-flex items-center text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        :aria-label="t('GitHub repository for this project')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M12.001 2c-5.525 0-10 4.475-10 10a9.994 9.994 0 0 0 6.837 9.488c.5.087.688-.213.688-.476c0-.237-.013-1.024-.013-1.862c-2.512.463-3.162-.612-3.362-1.175c-.113-.288-.6-1.175-1.025-1.413c-.35-.187-.85-.65-.013-.662c.788-.013 1.35.725 1.538 1.025c.9 1.512 2.337 1.087 2.912.825c.088-.65.35-1.087.638-1.337c-2.225-.25-4.55-1.113-4.55-4.938c0-1.088.387-1.987 1.025-2.688c-.1-.25-.45-1.275.1-2.65c0 0 .837-.262 2.75 1.026a9.28 9.28 0 0 1 2.5-.338c.85 0 1.7.112 2.5.337c1.913-1.3 2.75-1.024 2.75-1.024c.55 1.375.2 2.4.1 2.65c.637.7 1.025 1.587 1.025 2.687c0 3.838-2.337 4.688-4.563 4.938c.363.312.676.912.676 1.85c0 1.337-.013 2.412-.013 2.75c0 .262.188.574.688.474A10.016 10.016 0 0 0 22 12c0-5.525-4.475-10-10-10Z"
          />
        </svg>
      </a>

      <span class="dark:text-zinc-750 select-none text-zinc-300">•</span>

      <Dialog>
        <DialogTrigger as-child>
          <button
            class="relative text-xs font-semibold text-zinc-500 outline-none transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            :aria-label="t('View changelog')"
            :disabled="isLoading"
            @click="markAsSeen"
          >
            {{ isLoading ? '...' : version }}
            <span
              v-if="hasUnseenChangelog"
              class="absolute -right-1.5 -top-1.5 block size-1.5 rounded-full bg-blue-500 ring-1 ring-white dark:ring-zinc-900"
              aria-hidden="true"
            ></span>
          </button>
        </DialogTrigger>
        <DialogContent class="flex max-h-[80vh] flex-col sm:max-w-md" @open-auto-focus.prevent>
          <DialogHeader>
            <DialogTitle>{{ t('Changelog') }}</DialogTitle>
            <DialogClose
              class="absolute right-4 top-4 rounded-xl opacity-70 outline-none transition-opacity hover:opacity-100 focus:outline-none"
            >
              <X class="size-4" />
              <span class="sr-only">{{ t('Close') }}</span>
            </DialogClose>
          </DialogHeader>

          <div class="flex-1 overflow-y-auto pe-2">
            <DialogDescription
              as="div"
              class="prose prose-sm max-w-none text-start dark:prose-invert prose-li:my-1"
            >
              <div v-if="isLoading">Loading...</div>
              <div v-else-if="changelogContent" v-html="changelogContent"></div>
              <div v-else>{{ t('Failed to load changelog') }}</div>
            </DialogDescription>
          </div>
        </DialogContent>
      </Dialog>

      <span class="dark:text-zinc-750 select-none text-zinc-300">•</span>

      <button
        class="text-xs font-semibold text-zinc-500 outline-none transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        :aria-label="t('Sponsor')"
        @click="isPromptPayOpen = true"
      >{{ t('Sponsor') }}</button>

      <button
        @click="isAdminHistoryOpen = true"
        class="dark:text-zinc-650 dark:hover:bg-zinc-850 ml-0.5 rounded-lg p-0.5 text-zinc-400 opacity-20 outline-none transition-all hover:bg-zinc-100 hover:opacity-100"
      >
        <Key class="size-3" />
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
