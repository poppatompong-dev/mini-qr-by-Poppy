// @ts-nocheck Deno Edge Function — type-checked by the Deno toolchain at deploy
// time, not by the project's vue-tsc (which only scans src/).
// Edge Function: admin-shares
//
// Authenticated admin operations. Requires the `x-admin-secret` header to match
// the ADMIN_SECRET function secret. The admin secret NEVER ships to the browser
// bundle. Every mutating action is written to the append-only audit log.
//
// Request (POST): { action: 'list' }
//                 { action: 'delete', shareId }
//                 { action: 'expire', shareId }
// Response: { ok, data }

import { handleCors, corsHeaders } from '../_shared/cors.ts'
import { jsonError, jsonSuccess } from '../_shared/http.ts'
import { isAdminSecretValid, isValidShareId } from '../_shared/validation.ts'
import { createServiceClient, writeAuditLog, STORAGE_BUCKET } from '../_shared/client.ts'

async function removeStoragePrefix(client: ReturnType<typeof createServiceClient>, prefix: string) {
  const { data: objects } = await client.storage.from(STORAGE_BUCKET).list(prefix)
  if (objects && objects.length > 0) {
    const paths = objects.map((o) => `${prefix}/${o.name}`)
    await client.storage.from(STORAGE_BUCKET).remove(paths)
  }
}

Deno.serve(async (request: Request) => {
  const cors = handleCors(request)
  if (cors) return cors

  if (request.method !== 'POST') {
    return jsonError('METHOD_NOT_ALLOWED', 'Only POST is allowed', 405)
  }

  // --- Auth gate -----------------------------------------------------------
  const expectedSecret = Deno.env.get('ADMIN_SECRET')
  const receivedSecret = request.headers.get('x-admin-secret')
  if (!isAdminSecretValid(expectedSecret, receivedSecret)) {
    return jsonError('UNAUTHORIZED', 'Invalid or missing admin secret', 401)
  }

  let body: { action?: string; shareId?: string }
  try {
    body = await request.json()
  } catch {
    return jsonError('INVALID_PAYLOAD', 'Request body must be valid JSON', 400)
  }

  const action = body.action
  try {
    const client = createServiceClient()

    if (action === 'list') {
      const { data, error } = await client
        .from('qr_files_log')
        .select(
          'id, created_at, updated_at, file_name, file_url, file_size, files_list, status, expires_at, storage_prefix'
        )
        .order('created_at', { ascending: false })
      if (error) return jsonError('DB_ERROR', error.message, 500)
      return jsonSuccess({ shares: data ?? [] }, 200)
    }

    if (action === 'delete' || action === 'expire') {
      const shareId = body.shareId
      if (typeof shareId !== 'string' || !isValidShareId(shareId)) {
        return jsonError('INVALID_SHARE_ID', 'A valid shareId is required', 400)
      }

      const { data: share, error: fetchError } = await client
        .from('qr_files_log')
        .select('id, storage_prefix, status')
        .eq('id', shareId)
        .maybeSingle()
      if (fetchError) return jsonError('DB_ERROR', fetchError.message, 500)
      if (!share) return jsonError('NOT_FOUND', 'Share not found', 404)

      if (action === 'expire') {
        const { error } = await client
          .from('qr_files_log')
          .update({
            status: 'expired',
            expires_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', shareId)
        if (error) return jsonError('DB_ERROR', error.message, 500)
        await writeAuditLog(client, 'expire', shareId, {})
        return jsonSuccess({ shareId, status: 'expired' }, 200)
      }

      // delete: remove storage objects AND the metadata row.
      if (share.storage_prefix) {
        await removeStoragePrefix(client, share.storage_prefix as string)
      }
      const { error } = await client.from('qr_files_log').delete().eq('id', shareId)
      if (error) return jsonError('DB_ERROR', error.message, 500)
      await writeAuditLog(client, 'delete', shareId, { storage_prefix: share.storage_prefix })
      return jsonSuccess({ shareId, status: 'deleted' }, 200)
    }

    return jsonError('UNKNOWN_ACTION', `Unsupported action: ${action}`, 400)
  } catch (err) {
    console.error('admin-shares error:', err)
    return new Response(
      JSON.stringify({ ok: false, error: { code: 'UNKNOWN', message: 'Unexpected error' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
