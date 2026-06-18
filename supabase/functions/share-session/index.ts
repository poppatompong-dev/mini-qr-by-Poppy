// @ts-nocheck Deno Edge Function — type-checked by the Deno toolchain at deploy
// time, not by the project's vue-tsc (which only scans src/).
// Edge Function: share-session
//
// Step 1 of the file-sharing flow. Validates the proposed file manifest
// server-side, creates a `pending` record, and mints short-lived signed upload
// URLs so the client can upload files straight to Storage WITHOUT any
// anonymous write access to the bucket.
//
// Request  (POST):  { files: [{ safeName, storageName, size, type }] }
// Response (200):   { shareId, storagePrefix, expiresAt,
//                     uploads: [{ storageName, path, token, signedUrl }] }

import { handleCors, corsHeaders } from '../_shared/cors.ts'
import { jsonError, jsonSuccess } from '../_shared/http.ts'
import { validateShareManifestPayload, type ShareManifestItem } from '../_shared/validation.ts'
import { createServiceClient, getShareConfig, STORAGE_BUCKET } from '../_shared/client.ts'

Deno.serve(async (request: Request) => {
  const cors = handleCors(request)
  if (cors) return cors

  if (request.method !== 'POST') {
    return jsonError('METHOD_NOT_ALLOWED', 'Only POST is allowed', 405)
  }

  let payload: { files?: ShareManifestItem[] }
  try {
    payload = await request.json()
  } catch {
    return jsonError('INVALID_PAYLOAD', 'Request body must be valid JSON', 400)
  }

  const config = getShareConfig()
  const validation = validateShareManifestPayload(payload, {
    maxUploadBytes: config.maxUploadBytes,
    maxFilesPerShare: config.maxFilesPerShare
  })
  if (!validation.ok) {
    return jsonError(validation.code, validation.filename ?? 'Validation failed', 400)
  }

  const files = payload.files as ShareManifestItem[]

  try {
    const client = createServiceClient()

    const shareId = crypto.randomUUID()
    // Storage prefix is independent of the public share id so the storage
    // layout cannot be guessed from the landing URL.
    const storagePrefix = crypto.randomUUID()
    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    const expiresAt = new Date(Date.now() + config.expiryDays * 24 * 60 * 60 * 1000).toISOString()

    const { error: insertError } = await client.from('qr_files_log').insert({
      id: shareId,
      status: 'pending',
      storage_prefix: storagePrefix,
      file_size: totalSize,
      files_list: files.map((f) => f.safeName),
      expires_at: expiresAt,
      updated_at: new Date().toISOString()
    })
    if (insertError) {
      console.error('Failed to create pending share:', insertError)
      return jsonError('DB_ERROR', 'Failed to create share session', 500)
    }

    const uploads: Array<{ storageName: string; path: string; token: string; signedUrl: string }> =
      []
    for (const file of files) {
      const path = `${storagePrefix}/${file.storageName}`
      const { data, error } = await client.storage.from(STORAGE_BUCKET).createSignedUploadUrl(path)
      if (error || !data) {
        console.error('Failed to create signed upload URL:', error)
        // Roll back the pending record so we do not leave an orphan.
        await client.from('qr_files_log').delete().eq('id', shareId)
        return jsonError('SIGNED_URL_ERROR', 'Failed to create upload URL', 500)
      }
      uploads.push({
        storageName: file.storageName,
        path,
        token: data.token,
        signedUrl: data.signedUrl
      })
    }

    return jsonSuccess({ shareId, storagePrefix, expiresAt, uploads }, 200)
  } catch (err) {
    console.error('share-session error:', err)
    return new Response(
      JSON.stringify({ ok: false, error: { code: 'UNKNOWN', message: 'Unexpected error' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
