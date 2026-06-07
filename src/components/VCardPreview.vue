<script setup lang="ts">
import type { VCardCSVData } from '@/utils/csv'

const props = defineProps<{ vCard: VCardCSVData }>()

const address = [
  props.vCard.street,
  props.vCard.city,
  props.vCard.state,
  props.vCard.zipcode,
  props.vCard.country
]
  .filter(Boolean)
  .join(', ')
</script>
<template>
  <div
    class="border-[var(--accent-gold)]/30 mx-auto flex w-full flex-col gap-2.5 rounded-xl border bg-white p-6 shadow-md dark:bg-zinc-900/40 md:max-w-xs"
  >
    <div class="mb-2.5 border-b border-zinc-100 pb-2.5 dark:border-zinc-800">
      <p class="truncate text-lg font-bold text-zinc-800 dark:text-zinc-100">
        {{ vCard.firstName }} {{ vCard.lastName }}
      </p>
      <p v-if="vCard.position" class="truncate text-xs font-semibold text-[var(--accent-gold)]">
        {{ vCard.position }}
      </p>
      <p v-if="vCard.org" class="truncate text-[11px] text-zinc-400 dark:text-zinc-500">
        {{ vCard.org }}
      </p>
    </div>
    <div
      v-if="vCard.email"
      class="text-zinc-650 dark:text-zinc-350 flex items-center gap-2 text-xs"
    >
      <svg
        class="size-4 text-[var(--primary)] dark:text-[var(--accent-gold)]"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4h16v16H4V4zm0 0l8 8 8-8" />
      </svg>
      <span class="truncate">{{ vCard.email }}</span>
    </div>
    <div
      v-if="vCard.phonework"
      class="text-zinc-650 dark:text-zinc-350 flex items-center gap-2 text-xs"
    >
      <svg
        class="size-4 text-[var(--primary)] dark:text-[var(--accent-gold)]"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M3 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm0 10a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2zm10-10a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zm0 10a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
        />
      </svg>
      <span>{{ vCard.phonework }}</span>
    </div>
    <div
      v-if="vCard.website"
      class="text-zinc-650 dark:text-zinc-350 flex items-center gap-2 text-xs"
    >
      <svg
        class="size-4 text-[var(--primary)] dark:text-[var(--accent-gold)]"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      <span class="truncate"
        ><a
          :href="vCard.website"
          target="_blank"
          class="font-medium text-[var(--primary)] hover:underline dark:text-[var(--accent-gold)]"
          >{{ vCard.website }}</a
        ></span
      >
    </div>
    <div v-if="address" class="text-zinc-650 dark:text-zinc-350 flex items-center gap-2 text-xs">
      <svg
        class="size-4 text-[var(--primary)] dark:text-[var(--accent-gold)]"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"
        />
      </svg>
      <span class="break-words leading-relaxed">{{ address }}</span>
    </div>
  </div>
</template>
