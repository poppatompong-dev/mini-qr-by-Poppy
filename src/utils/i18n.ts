import { createI18n } from 'vue-i18n'
import en from '../../locales/en.json'
import th from '../../locales/th.json'

export const i18n = createI18n({
  locale: 'th',
  fallbackLocale: 'en',
  legacy: false,
  messages: {
    en,
    th
  }
})

