// @ts-nocheck Deno Edge Function — type-checked by the Deno toolchain at deploy
// time, not by the project's vue-tsc (which only scans src/).
// Edge Function: cleanup-expired-shares
//
// Idempotent maintenance job. Safe to run repeatedly (e.g. from pg_cron or a
// scheduled trigger). It:
//   * deletes storage objects + rows for shares whose expires_at has passed,
//   * reaps orphaned `pending`/`failed` shares older than ORPHAN_GRACE_MINUTES
//     (these come from abandoned or partial uploads).
//
// Auth: requires `x-admin-secret` (or the Supabase scheduler's service-role
// Authorization header). Returns a summary of what was cleaned.
//
// Response: { ok, data: { expiredRemoved, orphansRemoved, storageObjectsRemoved } }

import { handleCors, corsHeaders } from '../_shared/cors.ts'
import { jsonError, jsonSuccess } from '../_shared/http.ts'
import { isAdminSecretValid, getEnvInt } from '../_shared/validation.ts'
import { createServiceClient, writeAuditLog, STORAGE_BUCKET } from '../_shared/client.ts'

async function removePrefix(
  client: ReturnType<typeof createServiceClient>,
  prefix: string
): Promise<number> {
  if (!prefix) return 0
  const { data: objects } = await client.storage.from(STORAGE_BUCKET).list(prefix)
  if (!objects || objects.length === 0) return 0
  const paths = objects.map((o) => `${prefix}/${o.name}`)
  await client.storage.from(STORAGE_BUCKET).remove(paths)
  return paths.length
}

Deno.serve(async (request: Request) => {
  const cors = handleCors(request)
  if (cors) return cors

  // Allow either the admin secret OR the service-role bearer token used by the
  // Supabase scheduler.
  const expectedSecret = Deno.env.get('ADMIN_SECRET')
  const receivedSecret = request.headers.get('x-admin-secret')
  const authHeader = request.headers.get('authorization') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const hasServiceRole = serviceRoleKey.length > 0 && authHeader === `Bearer ${serviceRoleKey}`
  if (!hasServiceRole && !isAdminSecretValid(expectedSecret, receivedSecret)) {
    return jsonError('UNAUTHORIZED', 'Invalid or missing credentials', 401)
  }

  try {
    const client = createServiceClient()
    const nowIso = new Date().toISOString()
    const orphanGraceMinutes = getEnvInt(Deno.env.get('ORPHAN_GRACE_MINUTES'), 60, 5, 1440)
    const orphanCutoff = new Date(Date.now() - orphanGraceMinutes * 60 * 1000).toISOString()

    let storageObjectsRemoved = 0

    // 1. Expired shares (ready/expired with a past expires_at).
    const { data: expired, error: expiredError } = await client
      .from('qr_files_log')
      .select('id, storage_prefix')
      .lt('expires_at', nowIso)
      .in('status', ['ready', 'expired', 'pending'])
    if (expiredError) return jsonError('DB_ERROR', expiredError.message, 500)

    for (const row of expired ?? []) {
      storageObjectsRemoved += await removePrefix(client, row.storage_prefix as string)
    }
    const expiredIds = (expired ?? []).map((r) => r.id)
    if (expiredIds.length > 0) {
      await client.from('qr_files_log').delete().in('id', expiredIds)
    }

    // 2. Orphaned pending/failed shares older than the grace window.
    const { data: orphans, error: orphanError } = await client
      .from('qr_files_log')
      .select('id, storage_prefix')
      .in('status', ['pending', 'failed'])
      .lt('created_at', orphanCutoff)
    if (orphanError) return jsonError('DB_ERROR', orphanError.message, 500)

    for (const row of orphans ?? []) {
      storageObjectsRemoved += await removePrefix(client, row.storage_prefix as string)
    }
    const orphanIds = (orphans ?? []).map((r) => r.id)
    if (orphanIds.length > 0) {
      await client.from('qr_files_log').delete().in('id', orphanIds)
    }

    const summary = {
      expiredRemoved: expiredIds.length,
      orphansRemoved: orphanIds.length,
      storageObjectsRemoved
    }
    await writeAuditLog(client, 'cleanup', null, summary)
    return jsonSuccess(summary, 200)
  } catch (err) {
    console.error('cleanup-expired-shares error:', err)
    return new Response(
      JSON.stringify({ ok: false, error: { code: 'UNKNOWN', message: 'Unexpected error' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
