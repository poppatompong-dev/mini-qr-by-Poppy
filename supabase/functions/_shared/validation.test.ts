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
    expect(
      validateShareManifestPayload({
        files: Array.from({ length: MAX_FILES_PER_SHARE + 1 }, (_, index) => ({
          safeName: `a-${index}.txt`,
          storageName: `file_${index}.txt`,
          size: 1,
          type: 'text/plain'
        }))
      })
    ).toEqual({ ok: false, code: 'TOO_MANY_FILES' })
    expect(
      validateShareManifestPayload({
        files: [
          {
            safeName: 'large.txt',
            storageName: 'file_0.txt',
            size: MAX_UPLOAD_BYTES + 1,
            type: 'text/plain'
          }
        ]
      })
    ).toEqual({ ok: false, code: 'TOTAL_SIZE_EXCEEDED' })
    expect(
      validateShareManifestPayload({
        files: [{ safeName: 'safe.txt', storageName: 'file_0.txt', size: 1, type: 'text/plain' }]
      })
    ).toEqual({ ok: true })
  })

  it('rejects blocked extensions even when the client lies about them', () => {
    expect(
      validateShareManifestPayload({
        files: [
          {
            safeName: 'malware.exe',
            storageName: 'file_0.exe',
            size: 1,
            type: 'application/octet-stream'
          }
        ]
      })
    ).toEqual({ ok: false, code: 'BLOCKED_FILE_TYPE', filename: 'malware.exe' })
    expect(
      validateShareManifestPayload({
        files: [
          { safeName: 'payload.JS', storageName: 'file_0.js', size: 1, type: 'text/javascript' }
        ]
      })
    ).toEqual({ ok: false, code: 'BLOCKED_FILE_TYPE', filename: 'payload.JS' })
  })

  it('rejects spoofed storage names that try to escape the share prefix', () => {
    expect(
      validateShareManifestPayload({
        files: [
          { safeName: 'ok.txt', storageName: '../../etc/passwd', size: 1, type: 'text/plain' }
        ]
      })
    ).toEqual({ ok: false, code: 'INVALID_STORAGE_NAME', filename: '../../etc/passwd' })
    expect(
      validateShareManifestPayload({
        files: [{ safeName: 'ok.txt', storageName: 'arbitrary.txt', size: 1, type: 'text/plain' }]
      })
    ).toEqual({ ok: false, code: 'INVALID_STORAGE_NAME', filename: 'arbitrary.txt' })
  })

  it('rejects malformed file entries and oversized filenames', () => {
    expect(
      validateShareManifestPayload({ files: [{ storageName: 'file_0.txt', size: 1 }] })
    ).toEqual({ ok: false, code: 'INVALID_FILE' })
    expect(
      validateShareManifestPayload({
        files: [
          {
            safeName: `${'a'.repeat(200)}.txt`,
            storageName: 'file_0.txt',
            size: 1,
            type: 'text/plain'
          }
        ]
      })
    ).toEqual({ ok: false, code: 'FILENAME_TOO_LONG', filename: `${'a'.repeat(200)}.txt` })
    expect(validateShareManifestPayload('not-an-object')).toEqual({
      ok: false,
      code: 'INVALID_PAYLOAD'
    })
  })
})
