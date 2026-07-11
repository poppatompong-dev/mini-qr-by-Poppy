import { supabase, isSupabaseConfigured, supabaseUrl } from '@/utils/supabase'
import { buildSafeFileManifest, type SafeFileManifestItem } from '@/utils/fileShareValidation'

const STORAGE_BUCKET = 'qr-files'

export interface ShareSessionUpload {
  storageName: string
  path: string
  token: string
  signedUrl: string
}

export interface ShareSessionResponse {
  shareId: string
  storagePrefix: string
  expiresAt: string
  uploads: ShareSessionUpload[]
}

export interface CreateShareResult {
  shareId: string
  shareUrl: string
  expiresAt: string
  totalSize: number
  fileCount: number
}

export class ShareApiError extends Error {
  code: string
  filename?: string
  constructor(code: string, message: string, filename?: string) {
    super(message)
    this.code = code
    this.filename = filename
  }
}

interface FunctionEnvelope<T> {
  ok: boolean
  data?: T
  error?: { code: string; message: string }
}

/**
 * A request that never reached the server (DNS failure, offline, paused or
 * deleted Supabase project) surfaces as a fetch-level error rather than an
 * HTTP error. Browsers word it differently: Chrome "Failed to fetch",
 * Firefox "NetworkError...", Safari "Load failed", and supabase-js wraps it
 * as FunctionsFetchError ("Failed to send a request to the Edge Function").
 */
export function isNetworkFailure(err: unknown): boolean {
  if (!err) return false
  const name = (err as { name?: string }).name || ''
  const message = (err as { message?: string }).message || ''
  return (
    name === 'FunctionsFetchError' ||
    /failed to (send a request|fetch)/i.test(message) ||
    /networkerror|network error|load failed/i.test(message)
  )
}

/**
 * Quick reachability probe for the Supabase project host. A paused/deleted
 * project fails at the DNS level, so even an opaque no-cors response proves
 * the service is alive.
 */
export async function checkShareServiceReachable(timeoutMs = 5000): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  const controller = new window.AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    await fetch(`${supabaseUrl}/auth/v1/health`, {
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal
    })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

async function invokeFunction<T>(name: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  // Supabase wraps non-2xx responses in a FunctionsHttpError but still exposes
  // the JSON body via error.context. Try to surface our structured error code.
  if (error) {
    if (isNetworkFailure(error)) {
      throw new ShareApiError(
        'SERVICE_UNREACHABLE',
        'Cannot reach the file sharing server. The Supabase project may be paused or deleted.'
      )
    }
    let parsed: FunctionEnvelope<T> | null = null
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') parsed = await ctx.json()
    } catch {
      /* ignore parse failures */
    }
    if (parsed?.error) {
      throw new ShareApiError(parsed.error.code, parsed.error.message)
    }
    throw new ShareApiError('FUNCTION_ERROR', error.message || 'Edge function call failed')
  }

  const envelope = data as FunctionEnvelope<T>
  if (!envelope?.ok || !envelope.data) {
    throw new ShareApiError(
      envelope?.error?.code || 'UNKNOWN',
      envelope?.error?.message || 'Unexpected response from server'
    )
  }
  return envelope.data
}

export interface CreateShareOptions {
  fileName?: string
  onProgress?: (percent: number, currentFileName: string, index: number) => void
}

/**
 * Secure multi-file share creation:
 *   1. Validate + build a safe manifest client-side.
 *   2. share-session (server re-validates, creates pending record + signed URLs)
 *   3. Upload each file straight to Storage via its signed upload URL.
 *   4. share-finalize (server verifies uploads, flips status to ready).
 *
 * No anonymous write access to the bucket or table is used at any point.
 */
export async function createShareWithFiles(
  files: File[],
  options: CreateShareOptions = {}
): Promise<CreateShareResult> {
  if (!isSupabaseConfigured) {
    throw new ShareApiError('SUPABASE_NOT_CONFIGURED', 'Supabase is not configured')
  }

  const manifestResult = buildSafeFileManifest(files)
  if (!manifestResult.ok) {
    throw new ShareApiError(manifestResult.code, 'File validation failed', manifestResult.filename)
  }
  const manifest: SafeFileManifestItem[] = manifestResult.files

  // Step 1 — create the pending session + signed upload URLs.
  const session = await invokeFunction<ShareSessionResponse>('share-session', {
    files: manifest.map((item) => ({
      safeName: item.safeName,
      storageName: item.storageName,
      size: item.size,
      type: item.type
    }))
  })

  // Step 2 — upload each file via its signed URL.
  const uploadByName = new Map(session.uploads.map((u) => [u.storageName, u]))
  let totalSize = 0
  for (let i = 0; i < manifest.length; i++) {
    const item = manifest[i]
    const upload = uploadByName.get(item.storageName)
    if (!upload) {
      throw new ShareApiError(
        'SIGNED_URL_MISSING',
        `No upload URL for ${item.safeName}`,
        item.safeName
      )
    }
    options.onProgress?.(Math.round((i / manifest.length) * 90), item.safeName, i)

    const file = files[item.index]
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .uploadToSignedUrl(upload.path, upload.token, file, {
        contentType: item.type
      })
    if (uploadError) {
      if (isNetworkFailure(uploadError)) {
        throw new ShareApiError(
          'SERVICE_UNREACHABLE',
          'Cannot reach the file sharing server while uploading.',
          item.safeName
        )
      }
      throw new ShareApiError('UPLOAD_FAILED', uploadError.message, item.safeName)
    }
    totalSize += item.size
  }

  options.onProgress?.(95, '', manifest.length)

  // Step 3 — finalize.
  const shareUrl = `${window.location.origin}${window.location.pathname}?id=${session.shareId}`
  await invokeFunction<{ shareId: string; status: string }>('share-finalize', {
    shareId: session.shareId,
    fileName: options.fileName,
    shareUrl
  })

  options.onProgress?.(100, '', manifest.length)

  return {
    shareId: session.shareId,
    shareUrl,
    expiresAt: session.expiresAt,
    totalSize,
    fileCount: manifest.length
  }
}

export interface AdminShareRecord {
  id: string
  created_at: string
  updated_at: string
  file_name: string
  file_url: string | null
  file_size: number
  files_list: string[]
  status: string
  expires_at: string | null
  storage_prefix: string | null
}

/** Calls the admin-shares Edge Function with the provided secret. */
export async function adminInvoke<T>(
  action: 'list' | 'delete' | 'expire',
  adminSecret: string,
  shareId?: string
): Promise<T> {
  if (!isSupabaseConfigured) {
    throw new ShareApiError('SUPABASE_NOT_CONFIGURED', 'Supabase is not configured')
  }
  const { data, error } = await supabase.functions.invoke('admin-shares', {
    body: { action, shareId },
    headers: { 'x-admin-secret': adminSecret }
  })
  if (error) {
    if (isNetworkFailure(error)) {
      throw new ShareApiError(
        'SERVICE_UNREACHABLE',
        'Cannot reach the file sharing server. The Supabase project may be paused or deleted.'
      )
    }
    let parsed: FunctionEnvelope<T> | null = null
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') parsed = await ctx.json()
    } catch {
      /* ignore */
    }
    if (parsed?.error) throw new ShareApiError(parsed.error.code, parsed.error.message)
    throw new ShareApiError('FUNCTION_ERROR', error.message || 'Admin function call failed')
  }
  const envelope = data as FunctionEnvelope<T>
  if (!envelope?.ok) {
    throw new ShareApiError(
      envelope?.error?.code || 'UNKNOWN',
      envelope?.error?.message || 'Admin action failed'
    )
  }
  return envelope.data as T
}
