import { describe, expect, it } from 'vitest'
import { resolveStorageName } from './shareStorageNames'

describe('resolveStorageName', () => {
  it('matches the indexed name written by the uploader', () => {
    expect(resolveStorageName('report.pdf', 0, ['file_0.pdf'])).toBe('file_0.pdf')
    expect(resolveStorageName('sheet.xlsx', 2, ['file_0.pdf', 'file_2.xlsx'])).toBe('file_2.xlsx')
  })

  it('lower-cases the extension the way the uploader does', () => {
    // A phone or scanner hands over IMG_1234.JPG; storage holds file_0.jpg.
    expect(resolveStorageName('IMG_1234.JPG', 0, ['file_0.jpg'])).toBe('file_0.jpg')
    expect(resolveStorageName('SCAN.PDF', 1, ['file_1.pdf'])).toBe('file_1.pdf')
  })

  it('falls back to the display name for shares stored under it', () => {
    expect(resolveStorageName('legacy.png', 0, ['legacy.png'])).toBe('legacy.png')
  })

  it('matches case-insensitively for objects written before normalisation', () => {
    expect(resolveStorageName('photo.jpg', 0, ['file_0.JPG'])).toBe('file_0.JPG')
  })

  it('returns the expected name when storage has nothing matching', () => {
    expect(resolveStorageName('missing.png', 3, [])).toBe('file_3.png')
  })

  it('handles names without an extension', () => {
    expect(resolveStorageName('README', 0, ['file_0'])).toBe('file_0')
  })
})
