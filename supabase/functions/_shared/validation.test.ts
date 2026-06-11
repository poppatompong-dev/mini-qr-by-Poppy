import { describe, expect, it } from 'vitest'
import {
  MAX_FILES_PER_SHARE,
  MAX_UPLOAD_BYTES,
  getEnvInt,
  isAdminSecretValid,
  validateShareManifestPayload
} from './validation'

describe('Edge Function validation', () => {
  it('reads bounded integer config from environment strings', () => {
    expect(getEnvInt('50', 10, 1, 100)).toBe(50)
    expect(getEnvInt('0', 10, 1, 100)).toBe(10)
    expect(getEnvInt('200', 10, 1, 100)).toBe(10)
    expect(getEnvInt(undefined, 10, 1, 100)).toBe(10)
  })

  it('validates admin secret equality without accepting empty values', () => {
    expect(isAdminSecretValid('abc', 'abc')).toBe(true)
    expect(isAdminSecretValid('abc', 'wrong')).toBe(false)
    expect(isAdminSecretValid('', '')).toBe(false)
  })

  it('validates share payload limits', () => {
    expect(validateShareManifestPayload({ files: [] })).toEqual({ ok: false, code: 'NO_FILES' })
    expect(validateShareManifestPayload({ files: Array.from({ length: MAX_FILES_PER_SHARE + 1 }, (_, index) => ({ safeName: `a-${index}.txt`, storageName: `file_${index}.txt`, size: 1, type: 'text/plain' })) })).toEqual({ ok: false, code: 'TOO_MANY_FILES' })
    expect(validateShareManifestPayload({ files: [{ safeName: 'large.txt', storageName: 'file_0.txt', size: MAX_UPLOAD_BYTES + 1, type: 'text/plain' }] })).toEqual({ ok: false, code: 'TOTAL_SIZE_EXCEEDED' })
    expect(validateShareManifestPayload({ files: [{ safeName: 'safe.txt', storageName: 'file_0.txt', size: 1, type: 'text/plain' }] })).toEqual({ ok: true })
  })
})
