export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const MAX_FILES_PER_SHARE = 20
export const MAX_FILENAME_LENGTH = 120

export const BLOCKED_FILE_EXTENSIONS = [
  '.exe',
  '.msi',
  '.bat',
  '.cmd',
  '.com',
  '.scr',
  '.ps1',
  '.vbs',
  '.js',
  '.jar',
  '.app',
  '.deb',
  '.rpm'
] as const

export type ShareValidationCode =
  | 'NO_FILES'
  | 'TOO_MANY_FILES'
  | 'TOTAL_SIZE_EXCEEDED'
  | 'BLOCKED_FILE_TYPE'
  | 'INVALID_SHARE_ID'
  | 'SUPABASE_NOT_CONFIGURED'
  | 'SESSION_EXPIRED'
  | 'UNAUTHORIZED'
  | 'UNKNOWN'

export interface SafeFileManifestItem {
  index: number
  originalName: string
  safeName: string
  storageName: string
  size: number
  type: string
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; code: ShareValidationCode; filename?: string }

export type BuildManifestResult =
  | { ok: true; files: SafeFileManifestItem[]; totalSize: number }
  | { ok: false; code: ShareValidationCode; filename?: string }

export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot <= 0 || lastDot === filename.length - 1) return ''
  return filename.slice(lastDot).toLowerCase()
}

export function sanitizeFilename(filename: string): string {
  const extension = getFileExtension(filename)
  const base = filename
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    /* eslint-disable-next-line no-control-regex */
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')

  const safeBase = base || 'unnamed'
  if (safeBase.length <= MAX_FILENAME_LENGTH) return safeBase

  if (!extension) return safeBase.slice(0, MAX_FILENAME_LENGTH)
  const baseWithoutExtension = safeBase.slice(0, -extension.length)
  return `${baseWithoutExtension.slice(0, MAX_FILENAME_LENGTH - extension.length)}${extension}`
}

export function isBlockedFileExtension(filename: string): boolean {
  return BLOCKED_FILE_EXTENSIONS.includes(getFileExtension(filename) as (typeof BLOCKED_FILE_EXTENSIONS)[number])
}

export function isValidShareId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function validateFileManifest(files: Array<Pick<File, 'name' | 'size' | 'type'>>): ValidationResult {
  if (files.length === 0) return { ok: false, code: 'NO_FILES' }
  if (files.length > MAX_FILES_PER_SHARE) return { ok: false, code: 'TOO_MANY_FILES' }

  let totalSize = 0
  for (const file of files) {
    totalSize += file.size
    if (isBlockedFileExtension(file.name)) {
      return { ok: false, code: 'BLOCKED_FILE_TYPE', filename: file.name }
    }
  }

  if (totalSize > MAX_UPLOAD_BYTES) return { ok: false, code: 'TOTAL_SIZE_EXCEEDED' }
  return { ok: true }
}

export function buildSafeFileManifest(files: Array<Pick<File, 'name' | 'size' | 'type'>>): BuildManifestResult {
  const validation = validateFileManifest(files)
  if (!validation.ok) return validation

  const usedNames = new Set<string>()
  const safeFiles: SafeFileManifestItem[] = []
  let totalSize = 0

  files.forEach((file, index) => {
    const originalName = file.name || `file-${index}`
    const originalExtension = getFileExtension(originalName)
    let safeName = sanitizeFilename(originalName)

    if (originalExtension && !safeName.toLowerCase().endsWith(originalExtension)) {
      safeName = sanitizeFilename(`${safeName}${originalExtension}`)
    }

    const extension = getFileExtension(safeName)
    const baseName = extension ? safeName.slice(0, -extension.length) : safeName
    let candidate = safeName
    let counter = 1

    while (usedNames.has(candidate.toLowerCase())) {
      candidate = sanitizeFilename(`${baseName} (${counter})${extension}`)
      counter++
    }

    usedNames.add(candidate.toLowerCase())
    totalSize += file.size
    safeFiles.push({
      index,
      originalName,
      safeName: candidate,
      storageName: `file_${index}${extension}`,
      size: file.size,
      type: file.type || 'application/octet-stream'
    })
  })

  return { ok: true, files: safeFiles, totalSize }
}

export function mapShareErrorMessage(code: string, filename?: string): string {
  switch (code) {
    case 'NO_FILES':
      return 'กรุณาเลือกไฟล์อย่างน้อย 1 ไฟล์ก่อนอัปโหลด'
    case 'TOO_MANY_FILES':
      return `อัปโหลดได้สูงสุด ${MAX_FILES_PER_SHARE} ไฟล์ต่อชุด`
    case 'TOTAL_SIZE_EXCEEDED':
      return 'ขนาดไฟล์รวมต้องไม่เกิน 10 MB ต่อชุด'
    case 'BLOCKED_FILE_TYPE':
      return filename ? `ไม่อนุญาตให้อัปโหลดไฟล์ชนิดนี้: ${filename}` : 'ไม่อนุญาตให้อัปโหลดไฟล์ชนิดนี้'
    case 'INVALID_SHARE_ID':
      return 'ลิงก์แชร์ไม่ถูกต้อง กรุณาตรวจสอบ QR Code หรือลิงก์อีกครั้ง'
    case 'SUPABASE_NOT_CONFIGURED':
      return 'ยังไม่ได้ตั้งค่าระบบฝากไฟล์ Supabase สำหรับเว็บไซต์นี้'
    case 'SESSION_EXPIRED':
      return 'ลิงก์แชร์หมดอายุหรือถูกลบแล้ว'
    case 'UNAUTHORIZED':
      return 'รหัสผู้ดูแลระบบไม่ถูกต้อง'
    default:
      return 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
  }
}
