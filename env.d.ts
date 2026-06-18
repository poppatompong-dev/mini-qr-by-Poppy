/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly BASE_PATH?: string
  readonly VITE_HIDE_CREDITS?: string
  readonly VITE_DEFAULT_PRESET?: string
  readonly VITE_DEFAULT_DATA_TO_ENCODE?: string
  readonly VITE_QR_CODE_PRESETS?: string
  readonly VITE_FRAME_PRESET?: string
  readonly VITE_FRAME_PRESETS?: string
  readonly VITE_DISABLE_LOCAL_STORAGE?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_SHARE_EXPIRY_DAYS?: string
  readonly VITE_ENABLE_SPONSOR_MODAL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
