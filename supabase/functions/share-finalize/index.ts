// @ts-nocheck Deno Edge Function — type-checked by the Deno toolchain at deploy
// time, not by the project's vue-tsc (which only scans src/).
// Edge Function: share-finalize
//
// Step 2 of the file-sharing flow. Verifies that every file declared in the
// pending share was actually uploaded to Storage, then flips the record to
// `ready` so it becomes publicly readable. If verification fails the record is
// marked `failed` and the partial objects are cleaned up.
//
// Request  (POST):  { shareId, fileName?, shareUrl? }
// Response (200):   { shareId, status: 'ready', expiresAt }

import { handleCors, corsHeaders } from '../_shared/cors.ts'
import { jsonError, jsonSuccess } from '../_shared/http.ts'
import { getFileExtension } from '../_shared/validation.ts'
import { createServiceClient, STORAGE_BUCKET } from '../_shared/client.ts'

function deriveStorageName(index: number, filename: string): string {
  return `file_${index}${getFileExtension(filename)}`
}

function sanitizeShareUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

Deno.serve(async (request: Request) => {
  const cors = handleCors(request)
  if (cors) return cors

  if (request.method !== 'POST') {
    return jsonError('METHOD_NOT_ALLOWED', 'Only POST is allowed', 405)
  }

  let body: { shareId?: string; fileName?: string; shareUrl?: string }
  try {
    body = await request.json()
  } catch {
    return jsonError('INVALID_PAYLOAD', 'Request body must be valid JSON', 400)
  }

  const shareId = body.shareId
  if (typeof shareId !== 'string' || !shareId) {
    return jsonError('INVALID_SHARE_ID', 'shareId is required', 400)
  }

  try {
    const client = createServiceClient()

    const { data: share, error: fetchError } = await client
      .from('qr_files_log')
      .select('id, status, storage_prefix, files_list, expires_at')
      .eq('id', shareId)
      .maybeSingle()

    if (fetchError) {
      console.error('Failed to load share for finalize:', fetchError)
      return jsonError('DB_ERROR', 'Failed to load share', 500)
    }
    if (!share) return jsonError('NOT_FOUND', 'Share not found', 404)
    if (share.status === 'ready') {
      return jsonSuccess({ shareId, status: 'ready', expiresAt: share.expires_at }, 200)
    }
    if (share.status !== 'pending') {
      return jsonError('INVALID_STATE', `Cannot finalize a ${share.status} share`, 409)
    }

    const prefix = share.storage_prefix as string
    const filesList = (share.files_list as string[]) ?? []

    const { data: objects, error: listError } = await client.storage
      .from(STORAGE_BUCKET)
      .list(prefix)
    if (listError) {
      console.error('Failed to list storage objects:', listError)
      return jsonError('STORAGE_ERROR', 'Failed to verify uploads', 500)
    }

    const objectByName = new Map((objects ?? []).map((o) => [o.name, o]))
    let totalSize = 0
    const missing: string[] = []

    filesList.forEach((filename, index) => {
      const storageName = deriveStorageName(index, filename)
      const object = objectByName.get(storageName)
      if (!object) {
        missing.push(filename)
      } else {
        totalSize += (object.metadata as { size?: number } | null)?.size ?? 0
      }
    })

    if (missing.length > 0) {
      // Partial / failed upload: mark failed and remove whatever made it in.
      const paths = (objects ?? []).map((o) => `${prefix}/${o.name}`)
      if (paths.length > 0) {
        await client.storage.from(STORAGE_BUCKET).remove(paths)
      }
      await client
        .from('qr_files_log')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', shareId)
      return jsonError('UPLOAD_INCOMPLETE', `Missing ${missing.length} file(s)`, 422)
    }

    const update: Record<string, unknown> = {
      status: 'ready',
      file_size: totalSize,
      updated_at: new Date().toISOString()
    }
    const safeShareUrl = sanitizeShareUrl(body.shareUrl)
    if (safeShareUrl) update.file_url = safeShareUrl
    if (typeof body.fileName === 'string' && body.fileName.trim()) {
      update.file_name = body.fileName.trim().slice(0, 200)
    }

    const { error: updateError } = await client
      .from('qr_files_log')
      .update(update)
      .eq('id', shareId)
    if (updateError) {
      console.error('Failed to finalize share:', updateError)
      return jsonError('DB_ERROR', 'Failed to finalize share', 500)
    }

    return jsonSuccess({ shareId, status: 'ready', expiresAt: share.expires_at }, 200)
  } catch (err) {
    console.error('share-finalize error:', err)
    return new Response(
      JSON.stringify({ ok: false, error: { code: 'UNKNOWN', message: 'Unexpected error' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
