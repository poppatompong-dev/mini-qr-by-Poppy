/**
 * Extensions we are willing to hand to an <img> tag for a thumbnail.
 *
 * The list is deliberately wider than what every browser can decode — Safari
 * renders HEIC, Chrome does not, and TIFF support is patchy everywhere. Callers
 * are expected to fall back to the generic file icon on the img `error` event,
 * so an optimistic guess costs nothing while a too-narrow list silently denies
 * a thumbnail to formats that would have rendered fine.
 */
const IMAGE_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'jfif',
  'pjpeg',
  'gif',
  'webp',
  'svg',
  'bmp',
  'avif',
  'apng',
  'ico',
  'heic',
  'heif',
  'tif',
  'tiff'
] as const

/** True when the filename looks like an image we can try to render inline. */
export const isImageFilename = (filename: string): boolean => {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return (IMAGE_EXTENSIONS as readonly string[]).includes(ext)
}

/**
 * True when a picked File looks like an image. The MIME type is the better
 * signal when the browser provides one, but it comes back empty for files
 * pasted from the clipboard and for some Android pickers, so the extension is
 * used as a fallback rather than trusting `type` alone.
 */
export const isImageFile = (file: Pick<File, 'name' | 'type'>): boolean =>
  file.type.startsWith('image/') || isImageFilename(file.name)
