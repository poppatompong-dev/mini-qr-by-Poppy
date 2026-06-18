// @ts-nocheck Deno-only module (uses Deno globals + esm.sh imports). Not part
// of the vue-tsc/vitest TypeScript program.
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getEnvInt } from './validation.ts'

export const STORAGE_BUCKET = 'qr-files'

/**
 * Creates a Supabase client using the service role key. This client bypasses
 * RLS and must ONLY ever be used inside Edge Functions, never shipped to the
 * browser.
 */
export function createServiceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}

export interface ShareConfig {
  maxUploadBytes: number
  maxFilesPerShare: number
  expiryDays: number
}

/** Reads share limits from Edge Function secrets, with safe bounded defaults. */
export function getShareConfig(): ShareConfig {
  return {
    maxUploadBytes: getEnvInt(
      Deno.env.get('MAX_UPLOAD_BYTES'),
      10 * 1024 * 1024,
      1024,
      200 * 1024 * 1024
    ),
    maxFilesPerShare: getEnvInt(Deno.env.get('MAX_FILES_PER_SHARE'), 20, 1, 200),
    expiryDays: getEnvInt(Deno.env.get('SHARE_EXPIRY_DAYS'), 7, 1, 365)
  }
}

/** Records an admin action in the append-only audit log (best-effort). */
export async function writeAuditLog(
  client: SupabaseClient,
  action: string,
  shareId: string | null,
  detail: Record<string, unknown> = {}
): Promise<void> {
  try {
    await client.from('qr_admin_audit_log').insert({ action, share_id: shareId, detail })
  } catch (err) {
    console.error('Failed to write audit log:', err)
  }
}
