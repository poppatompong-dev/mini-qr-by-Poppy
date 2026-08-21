import { getFileExtension } from './fileShareValidation'

/**
 * Maps a file's display name to the object name it was actually stored under.
 *
 * Uploads write `file_<index><ext>` with the extension lower-cased (see
 * buildSafeFileManifest), while the share record keeps the name the sender
 * chose. A share view that rebuilds the storage name has to normalise the
 * extension the same way: `PHOTO.JPG` is stored as `file_0.jpg`, and asking for
 * `file_0.JPG` returns 404 — which reads as a missing thumbnail, a dead preview
 * and a failed download all at once.
 *
 * @param displayName Name as shown to the recipient (from `files_list`).
 * @param index Position of the file within the share.
 * @param namesInStorage Object names present under the share's storage prefix.
 * @returns The matching object name, or the expected name when nothing matches
 *   so the caller still produces a URL rather than nothing at all.
 */
export function resolveStorageName(
  displayName: string,
  index: number,
  namesInStorage: readonly string[]
): string {
  const indexedName = `file_${index}${getFileExtension(displayName)}`

  if (namesInStorage.includes(indexedName)) return indexedName
  if (namesInStorage.includes(displayName)) return displayName

  // Objects written before extensions were normalised may differ only by case.
  const lowered = indexedName.toLowerCase()
  const loweredDisplay = displayName.toLowerCase()
  const caseInsensitive = namesInStorage.find(
    (name) => name.toLowerCase() === lowered || name.toLowerCase() === loweredDisplay
  )

  return caseInsensitive ?? indexedName
}
