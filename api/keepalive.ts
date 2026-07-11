// Vercel serverless function invoked daily by the cron in vercel.json.
//
// Supabase pauses free-tier projects after ~7 days without DATABASE activity,
// which took the file-share feature down for real users. This endpoint keeps
// the project permanently awake by running a genuine DB query every day, and
// (when ADMIN_SECRET is configured) also triggers the cleanup-expired-shares
// Edge Function so expired files are actually reaped on schedule.
//
// Safe to call publicly: the DB touch is a read-only SELECT limited to 1 row,
// and the cleanup function is idempotent and requires the server-side secret.

interface VercelRequestLike {
  method?: string
}

interface VercelResponseLike {
  status: (code: number) => { json: (body: unknown) => void }
}

export default async function handler(_req: VercelRequestLike, res: VercelResponseLike) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

  if (!supabaseUrl || !anonKey) {
    res.status(500).json({ ok: false, error: 'Supabase env vars are not configured' })
    return
  }

  const result: Record<string, unknown> = { at: new Date().toISOString() }

  // 1. Touch the database — this is what resets Supabase's inactivity timer.
  try {
    const ping = await fetch(`${supabaseUrl}/rest/v1/qr_files_log?select=id&limit=1`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`
      }
    })
    result.dbPing = ping.status
    result.ok = ping.ok
  } catch (err) {
    res.status(502).json({
      ok: false,
      error: `Supabase unreachable: ${err instanceof Error ? err.message : 'unknown'}`,
      ...result
    })
    return
  }

  // 2. Optionally reap expired shares while we are here.
  const adminSecret = process.env.ADMIN_SECRET || ''
  if (adminSecret) {
    try {
      const cleanup = await fetch(`${supabaseUrl}/functions/v1/cleanup-expired-shares`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'x-admin-secret': adminSecret
        }
      })
      result.cleanupStatus = cleanup.status
      try {
        result.cleanupSummary = (await cleanup.json())?.data ?? null
      } catch {
        result.cleanupSummary = null
      }
    } catch (err) {
      result.cleanupError = err instanceof Error ? err.message : 'unknown'
    }
  }

  res.status(result.ok ? 200 : 502).json(result)
}
