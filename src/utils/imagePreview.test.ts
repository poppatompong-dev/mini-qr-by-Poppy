import { describe, expect, it } from 'vitest'
import { isImageFile, isImageFilename } from './imagePreview'

describe('isImageFilename', () => {
  it('accepts common web image extensions regardless of case', () => {
    expect(isImageFilename('photo.PNG')).toBe(true)
    expect(isImageFilename('scan.Jpeg')).toBe(true)
    expect(isImageFilename('logo.svg')).toBe(true)
  })

  it('accepts formats older builds skipped', () => {
    expect(isImageFilename('camera.heic')).toBe(true)
    expect(isImageFilename('fax.tiff')).toBe(true)
    expect(isImageFilename('save.jfif')).toBe(true)
    expect(isImageFilename('shot.avif')).toBe(true)
  })

  it('rejects non-images and extensionless names', () => {
    expect(isImageFilename('report.pdf')).toBe(false)
    expect(isImageFilename('archive.zip')).toBe(false)
    expect(isImageFilename('README')).toBe(false)
  })
})

describe('isImageFile', () => {
  it('trusts the MIME type when the browser supplies one', () => {
    expect(isImageFile({ name: 'blob', type: 'image/png' })).toBe(true)
  })

  it('falls back to the extension when the MIME type is empty', () => {
    // Clipboard pastes and some Android pickers hand over an empty type.
    expect(isImageFile({ name: 'pasted.png', type: '' })).toBe(true)
  })

  it('rejects non-image files', () => {
    expect(isImageFile({ name: 'notes.pdf', type: 'application/pdf' })).toBe(false)
  })
})
