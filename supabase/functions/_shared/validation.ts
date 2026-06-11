export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const MAX_FILES_PER_SHARE = 20
export const MAX_FILENAME_LENGTH = 120

const BLOCKED_FILE_EXTENSIONS = new Set(['.exe', '.msi', '.bat', '.cmd', '.com', '.scr', '.ps1', '.vbs', '.js', '.jar', '.app', '.deb', '.rpm'])

export interface ShareManifestItem {
  safeName: string
  storageName: string
  size: number
  type: string
}

export type EdgeValidationResult = { ok: true } | { ok: false; code: string; filename?: string }

export function getEnvInt(value: string | undefined, fallback: number, min: number, max: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return fallback
  return parsed
}

export function isAdminSecretValid(expectedSecret: string | undefined, receivedSecret: string | null): boolean {
  if (!expectedSecret || !receivedSecret) return false
  return expectedSecret === receivedSecret
}

export function getFileExtension(filename: string): string {
  const index = filename.lastIndexOf('.')
  if (index <= 0 || index === filename.length - 1) return ''
  return filename.slice(index).toLowerCase()
}

export function validateShareManifestPayload(payload: unknown): EdgeValidationResult {
  if (!payload || typeof payload !== 'object') return { ok: false, code: 'INVALID_PAYLOAD' }
  const files = (payload as { files?: unknown }).files
  if (!Array.isArray(files) || files.length === 0) return { ok: false, code: 'NO_FILES' }
  if (files.length > MAX_FILES_PER_SHARE) return { ok: false, code: 'TOO_MANY_FILES' }

  let totalSize = 0
  for (const file of files) {
    if (!file || typeof file !== 'object') return { ok: false, code: 'INVALID_FILE' }
    const item = file as Partial<ShareManifestItem>
    if (typeof item.safeName !== 'string' || typeof item.storageName !== 'string') return { ok: false, code: 'INVALID_FILE' }
    if (typeof item.size !== 'number' || item.size < 0) return { ok: false, code: 'INVALID_FILE' }
    if (item.safeName.length > MAX_FILENAME_LENGTH) return { ok: false, code: 'FILENAME_TOO_LONG', filename: item.safeName }
    if (BLOCKED_FILE_EXTENSIONS.has(getFileExtension(item.safeName))) return { ok: false, code: 'BLOCKED_FILE_TYPE', filename: item.safeName }
    if (!/^file_\d+(\.[a-z0-9]+)?$/i.test(item.storageName)) return { ok: false, code: 'INVALID_STORAGE_NAME', filename: item.storageName }
    totalSize += item.size
  }

  if (totalSize > MAX_UPLOAD_BYTES) return { ok: false, code: 'TOTAL_SIZE_EXCEEDED' }
  return { ok: true }
}
