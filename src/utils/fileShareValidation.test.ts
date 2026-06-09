import { describe, expect, it } from 'vitest'
import {
  BLOCKED_FILE_EXTENSIONS,
  MAX_FILES_PER_SHARE,
  MAX_FILENAME_LENGTH,
  MAX_UPLOAD_BYTES,
  buildSafeFileManifest,
  getFileExtension,
  isBlockedFileExtension,
  isValidShareId,
  mapShareErrorMessage,
  sanitizeFilename,
  validateFileManifest
} from './fileShareValidation'

const file = (name: string, size: number, type = 'text/plain') => ({ name, size, type }) as File

describe('fileShareValidation', () => {
  it('sanitizes illegal filename characters and trims long names', () => {
    const longName = `${'a'.repeat(MAX_FILENAME_LENGTH + 20)}.txt`
    expect(sanitizeFilename(' bad:/name?.txt ')).toBe('badname.txt')
    expect(sanitizeFilename(longName).length).toBeLessThanOrEqual(MAX_FILENAME_LENGTH)
    expect(sanitizeFilename('////')).toBe('unnamed')
  })

  it('extracts lowercase file extensions', () => {
    expect(getFileExtension('report.PDF')).toBe('.pdf')
    expect(getFileExtension('no-extension')).toBe('')
  })

  it('blocks high-risk executable and script extensions', () => {
    expect(BLOCKED_FILE_EXTENSIONS).toContain('.exe')
    expect(isBlockedFileExtension('setup.exe')).toBe(true)
    expect(isBlockedFileExtension('script.JS')).toBe(true)
    expect(isBlockedFileExtension('safe.pdf')).toBe(false)
  })

  it('validates UUID share IDs', () => {
    expect(isValidShareId('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
    expect(isValidShareId('not-a-uuid')).toBe(false)
  })

  it('rejects empty, too many, too large, and blocked file manifests', () => {
    expect(validateFileManifest([])).toEqual({ ok: false, code: 'NO_FILES' })
    expect(validateFileManifest(Array.from({ length: MAX_FILES_PER_SHARE + 1 }, (_, index) => file(`file-${index}.txt`, 1)))).toEqual({ ok: false, code: 'TOO_MANY_FILES' })
    expect(validateFileManifest([file('large.txt', MAX_UPLOAD_BYTES + 1)])).toEqual({ ok: false, code: 'TOTAL_SIZE_EXCEEDED' })
    expect(validateFileManifest([file('run.exe', 1)])).toEqual({ ok: false, code: 'BLOCKED_FILE_TYPE', filename: 'run.exe' })
  })

  it('builds a collision-safe manifest with storage names', () => {
    const result = buildSafeFileManifest([file('report.pdf', 10, 'application/pdf'), file('report.pdf', 20, 'application/pdf')])
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('manifest should be valid')
    expect(result.files).toEqual([
      { index: 0, originalName: 'report.pdf', safeName: 'report.pdf', storageName: 'file_0.pdf', size: 10, type: 'application/pdf' },
      { index: 1, originalName: 'report.pdf', safeName: 'report (1).pdf', storageName: 'file_1.pdf', size: 20, type: 'application/pdf' }
    ])
    expect(result.totalSize).toBe(30)
  })

  it('maps technical codes to Thai user-safe messages', () => {
    expect(mapShareErrorMessage('NO_FILES')).toContain('เลือกไฟล์')
    expect(mapShareErrorMessage('UNKNOWN')).toContain('ลองใหม่')
  })
})
