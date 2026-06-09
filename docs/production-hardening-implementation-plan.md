# Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden MiniQR for public production use by moving privileged Supabase operations behind Edge Functions, adding shared upload validation, improving file-sharing UX, tightening deployment docs, and aligning tests with pnpm/Corepack.

**Architecture:** Keep the Vue/Vite app static while using Supabase Edge Functions as the security boundary for share-session creation, finalization, cleanup, and admin operations. The browser performs immediate UX validation, receives signed upload tokens from Edge Functions, uploads files through Supabase Storage signed upload flow, and no longer writes admin-sensitive database/storage mutations directly.

**Tech Stack:** Vue 3, Vite 5, TypeScript, Supabase JS v2, Supabase Edge Functions on Deno, Vitest, Playwright, pnpm via Corepack.

---

## File Structure

### Create

- `src/utils/fileShareValidation.ts` — shared frontend validation for filenames, blocked extensions, file limits, UUID checks, and user-safe error mapping.
- `src/utils/fileShareValidation.test.ts` — Vitest coverage for the frontend validation helpers.
- `src/utils/shareApi.ts` — typed client wrapper for Supabase Edge Function calls and signed upload flow.
- `src/utils/shareApi.test.ts` — Vitest coverage for response parsing and error normalization.
- `supabase/functions/_shared/cors.ts` — common CORS headers and preflight response helper.
- `supabase/functions/_shared/http.ts` — stable `{ ok, data }` and `{ ok, error }` JSON response helpers.
- `supabase/functions/_shared/validation.ts` — Deno-compatible validation logic for Edge Functions.
- `supabase/functions/_shared/validation.test.ts` — Vitest coverage for Edge Function validation logic.
- `supabase/functions/_shared/supabase.ts` — service-role Supabase client factory for Edge Functions.
- `supabase/functions/share-session/index.ts` — creates pending share records and signed upload URLs.
- `supabase/functions/share-finalize/index.ts` — validates uploaded file manifests and marks shares ready.
- `supabase/functions/share-cleanup/index.ts` — marks failed sessions and removes storage objects under a share prefix.
- `supabase/functions/admin-shares/index.ts` — handles admin list/create/update/delete actions using `x-admin-secret`.
- `docs/supabase_production_setup.sql` — production-safe schema and policy setup.
- `docs/production-deployment-checklist.md` — deploy and verification checklist for public release.

### Modify

- `src/utils/supabase.ts` — export public Supabase config and keep the existing client export.
- `src/components/InlineDataTemplates.vue` — replace direct DB insert/direct storage upload flow with `shareApi`; add public file notice and validation messages.
- `src/components/FileShareView.vue` — validate share IDs and handle `status`/`expires_at` states.
- `src/components/AdminHistoryModal.vue` — replace local password comparison and direct Supabase mutations with `admin-shares` calls.
- `docs/supabase_setup.sql` — mark current broad-policy setup as development-only and point production users to `docs/supabase_production_setup.sql`.
- `.env.example` — document public frontend variables and explicitly state that admin secrets live in Supabase Function secrets.
- `playwright.config.ts` — use `corepack pnpm dev` for the web server command.
- `.husky/pre-commit` — use `corepack pnpm lint-staged` so hooks work on this machine and with the declared package manager.
- `vitest.workspace.ts` — include pure Edge Function shared tests under `supabase/functions/**/*.test.ts`.

---

## Task 1: Shared File Share Validation

**Files:**
- Create: `src/utils/fileShareValidation.ts`
- Create: `src/utils/fileShareValidation.test.ts`

- [ ] **Step 1: Write failing validation tests**

Create `src/utils/fileShareValidation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  BLOCKED_FILE_EXTENSIONS,
  MAX_FILES_PER_SHARE,
  MAX_FILENAME_LENGTH,
  MAX_UPLOAD_BYTES,
  buildSafeFileManifest,
  getFileExtension,
  isBlockedFileExtension,
  isValidShareId,
  mapShareErrorMessage,
  sanitizeFilename,
  validateFileManifest
} from './fileShareValidation'

const file = (name: string, size: number, type = 'text/plain') => ({ name, size, type }) as File

describe('fileShareValidation', () => {
  it('sanitizes illegal filename characters and trims long names', () => {
    const longName = `${'a'.repeat(MAX_FILENAME_LENGTH + 20)}.txt`
    expect(sanitizeFilename(' bad:/name?.txt ')).toBe('badname.txt')
    expect(sanitizeFilename(longName).length).toBeLessThanOrEqual(MAX_FILENAME_LENGTH)
    expect(sanitizeFilename('////')).toBe('unnamed')
  })

  it('extracts lowercase file extensions', () => {
    expect(getFileExtension('report.PDF')).toBe('.pdf')
    expect(getFileExtension('no-extension')).toBe('')
  })

  it('blocks high-risk executable and script extensions', () => {
    expect(BLOCKED_FILE_EXTENSIONS).toContain('.exe')
    expect(isBlockedFileExtension('setup.exe')).toBe(true)
    expect(isBlockedFileExtension('script.JS')).toBe(true)
    expect(isBlockedFileExtension('safe.pdf')).toBe(false)
  })

  it('validates UUID share IDs', () => {
    expect(isValidShareId('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
    expect(isValidShareId('not-a-uuid')).toBe(false)
  })

  it('rejects empty, too many, too large, and blocked file manifests', () => {
    expect(validateFileManifest([])).toEqual({ ok: false, code: 'NO_FILES' })
    expect(validateFileManifest(Array.from({ length: MAX_FILES_PER_SHARE + 1 }, (_, index) => file(`file-${index}.txt`, 1)))).toEqual({ ok: false, code: 'TOO_MANY_FILES' })
    expect(validateFileManifest([file('large.txt', MAX_UPLOAD_BYTES + 1)])).toEqual({ ok: false, code: 'TOTAL_SIZE_EXCEEDED' })
    expect(validateFileManifest([file('run.exe', 1)])).toEqual({ ok: false, code: 'BLOCKED_FILE_TYPE', filename: 'run.exe' })
  })

  it('builds a collision-safe manifest with storage names', () => {
    const result = buildSafeFileManifest([file('report.pdf', 10, 'application/pdf'), file('report.pdf', 20, 'application/pdf')])
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('manifest should be valid')
    expect(result.files).toEqual([
      { index: 0, originalName: 'report.pdf', safeName: 'report.pdf', storageName: 'file_0.pdf', size: 10, type: 'application/pdf' },
      { index: 1, originalName: 'report.pdf', safeName: 'report (1).pdf', storageName: 'file_1.pdf', size: 20, type: 'application/pdf' }
    ])
    expect(result.totalSize).toBe(30)
  })

  it('maps technical codes to Thai user-safe messages', () => {
    expect(mapShareErrorMessage('NO_FILES')).toContain('เลือกไฟล์')
    expect(mapShareErrorMessage('UNKNOWN')).toContain('ลองใหม่')
  })
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
corepack pnpm vitest src/utils/fileShareValidation.test.ts --run
```

Expected: FAIL because `src/utils/fileShareValidation.ts` does not exist.

- [ ] **Step 3: Implement shared validation utility**

Create `src/utils/fileShareValidation.ts`:

```ts
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const MAX_FILES_PER_SHARE = 20
export const MAX_FILENAME_LENGTH = 120

export const BLOCKED_FILE_EXTENSIONS = [
  '.exe',
  '.msi',
  '.bat',
  '.cmd',
  '.com',
  '.scr',
  '.ps1',
  '.vbs',
  '.js',
  '.jar',
  '.app',
  '.deb',
  '.rpm'
] as const

export type ShareValidationCode =
  | 'NO_FILES'
  | 'TOO_MANY_FILES'
  | 'TOTAL_SIZE_EXCEEDED'
  | 'BLOCKED_FILE_TYPE'
  | 'INVALID_SHARE_ID'
  | 'SUPABASE_NOT_CONFIGURED'
  | 'SESSION_EXPIRED'
  | 'UNAUTHORIZED'
  | 'UNKNOWN'

export interface SafeFileManifestItem {
  index: number
  originalName: string
  safeName: string
  storageName: string
  size: number
  type: string
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; code: ShareValidationCode; filename?: string }

export type BuildManifestResult =
  | { ok: true; files: SafeFileManifestItem[]; totalSize: number }
  | { ok: false; code: ShareValidationCode; filename?: string }

export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot <= 0 || lastDot === filename.length - 1) return ''
  return filename.slice(lastDot).toLowerCase()
}

export function sanitizeFilename(filename: string): string {
  const extension = getFileExtension(filename)
  const base = filename
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')

  const safeBase = base || 'unnamed'
  if (safeBase.length <= MAX_FILENAME_LENGTH) return safeBase

  if (!extension) return safeBase.slice(0, MAX_FILENAME_LENGTH)
  const baseWithoutExtension = safeBase.slice(0, -extension.length)
  return `${baseWithoutExtension.slice(0, MAX_FILENAME_LENGTH - extension.length)}${extension}`
}

export function isBlockedFileExtension(filename: string): boolean {
  return BLOCKED_FILE_EXTENSIONS.includes(getFileExtension(filename) as (typeof BLOCKED_FILE_EXTENSIONS)[number])
}

export function isValidShareId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function validateFileManifest(files: Array<Pick<File, 'name' | 'size' | 'type'>>): ValidationResult {
  if (files.length === 0) return { ok: false, code: 'NO_FILES' }
  if (files.length > MAX_FILES_PER_SHARE) return { ok: false, code: 'TOO_MANY_FILES' }

  let totalSize = 0
  for (const file of files) {
    totalSize += file.size
    if (isBlockedFileExtension(file.name)) {
      return { ok: false, code: 'BLOCKED_FILE_TYPE', filename: file.name }
    }
  }

  if (totalSize > MAX_UPLOAD_BYTES) return { ok: false, code: 'TOTAL_SIZE_EXCEEDED' }
  return { ok: true }
}

export function buildSafeFileManifest(files: Array<Pick<File, 'name' | 'size' | 'type'>>): BuildManifestResult {
  const validation = validateFileManifest(files)
  if (!validation.ok) return validation

  const usedNames = new Set<string>()
  const safeFiles: SafeFileManifestItem[] = []
  let totalSize = 0

  files.forEach((file, index) => {
    const originalName = file.name || `file-${index}`
    const originalExtension = getFileExtension(originalName)
    let safeName = sanitizeFilename(originalName)

    if (originalExtension && !safeName.toLowerCase().endsWith(originalExtension)) {
      safeName = sanitizeFilename(`${safeName}${originalExtension}`)
    }

    const extension = getFileExtension(safeName)
    const baseName = extension ? safeName.slice(0, -extension.length) : safeName
    let candidate = safeName
    let counter = 1

    while (usedNames.has(candidate.toLowerCase())) {
      candidate = sanitizeFilename(`${baseName} (${counter})${extension}`)
      counter++
    }

    usedNames.add(candidate.toLowerCase())
    totalSize += file.size
    safeFiles.push({
      index,
      originalName,
      safeName: candidate,
      storageName: `file_${index}${extension}`,
      size: file.size,
      type: file.type || 'application/octet-stream'
    })
  })

  return { ok: true, files: safeFiles, totalSize }
}

export function mapShareErrorMessage(code: string, filename?: string): string {
  switch (code) {
    case 'NO_FILES':
      return 'กรุณาเลือกไฟล์อย่างน้อย 1 ไฟล์ก่อนอัปโหลด'
    case 'TOO_MANY_FILES':
      return `อัปโหลดได้สูงสุด ${MAX_FILES_PER_SHARE} ไฟล์ต่อชุด`
    case 'TOTAL_SIZE_EXCEEDED':
      return 'ขนาดไฟล์รวมต้องไม่เกิน 10 MB ต่อชุด'
    case 'BLOCKED_FILE_TYPE':
      return filename ? `ไม่อนุญาตให้อัปโหลดไฟล์ชนิดนี้: ${filename}` : 'ไม่อนุญาตให้อัปโหลดไฟล์ชนิดนี้'
    case 'INVALID_SHARE_ID':
      return 'ลิงก์แชร์ไม่ถูกต้อง กรุณาตรวจสอบ QR Code หรือลิงก์อีกครั้ง'
    case 'SUPABASE_NOT_CONFIGURED':
      return 'ยังไม่ได้ตั้งค่าระบบฝากไฟล์ Supabase สำหรับเว็บไซต์นี้'
    case 'SESSION_EXPIRED':
      return 'ลิงก์แชร์หมดอายุหรือถูกลบแล้ว'
    case 'UNAUTHORIZED':
      return 'รหัสผู้ดูแลระบบไม่ถูกต้อง'
    default:
      return 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
  }
}
```

- [ ] **Step 4: Run validation tests and verify they pass**

Run:

```bash
corepack pnpm vitest src/utils/fileShareValidation.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Commit validation utility**

Run:

```bash
git add src/utils/fileShareValidation.ts src/utils/fileShareValidation.test.ts
git commit -m "feat: add file share validation utilities"
```

---

## Task 2: Edge Function Shared Utilities and Tests

**Files:**
- Create: `supabase/functions/_shared/cors.ts`
- Create: `supabase/functions/_shared/http.ts`
- Create: `supabase/functions/_shared/validation.ts`
- Create: `supabase/functions/_shared/validation.test.ts`
- Create: `supabase/functions/_shared/supabase.ts`
- Modify: `vitest.workspace.ts`

- [ ] **Step 1: Write failing Edge validation tests**

Create `supabase/functions/_shared/validation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  MAX_FILES_PER_SHARE,
  MAX_UPLOAD_BYTES,
  getEnvInt,
  isAdminSecretValid,
  validateShareManifestPayload
} from './validation'

describe('Edge Function validation', () => {
  it('reads bounded integer config from environment strings', () => {
    expect(getEnvInt('50', 10, 1, 100)).toBe(50)
    expect(getEnvInt('0', 10, 1, 100)).toBe(10)
    expect(getEnvInt('200', 10, 1, 100)).toBe(10)
    expect(getEnvInt(undefined, 10, 1, 100)).toBe(10)
  })

  it('validates admin secret equality without accepting empty values', () => {
    expect(isAdminSecretValid('abc', 'abc')).toBe(true)
    expect(isAdminSecretValid('abc', 'wrong')).toBe(false)
    expect(isAdminSecretValid('', '')).toBe(false)
  })

  it('validates share payload limits', () => {
    expect(validateShareManifestPayload({ files: [] })).toEqual({ ok: false, code: 'NO_FILES' })
    expect(validateShareManifestPayload({ files: Array.from({ length: MAX_FILES_PER_SHARE + 1 }, (_, index) => ({ safeName: `a-${index}.txt`, storageName: `file_${index}.txt`, size: 1, type: 'text/plain' })) })).toEqual({ ok: false, code: 'TOO_MANY_FILES' })
    expect(validateShareManifestPayload({ files: [{ safeName: 'large.txt', storageName: 'file_0.txt', size: MAX_UPLOAD_BYTES + 1, type: 'text/plain' }] })).toEqual({ ok: false, code: 'TOTAL_SIZE_EXCEEDED' })
    expect(validateShareManifestPayload({ files: [{ safeName: 'safe.txt', storageName: 'file_0.txt', size: 1, type: 'text/plain' }] })).toEqual({ ok: true })
  })
})
```

- [ ] **Step 2: Include Supabase shared tests in Vitest workspace**

Modify `vitest.workspace.ts` node project include from:

```ts
include: ['src/**/*.test.ts'],
```

to:

```ts
include: ['src/**/*.test.ts', 'supabase/functions/**/*.test.ts'],
```

Run:

```bash
corepack pnpm vitest supabase/functions/_shared/validation.test.ts --run
```

Expected: FAIL because `supabase/functions/_shared/validation.ts` does not exist.

- [ ] **Step 3: Implement shared Edge helpers**

Create `supabase/functions/_shared/cors.ts`:

```ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}

export function handleCors(request: Request): Response | null {
  if (request.method !== 'OPTIONS') return null
  return new Response('ok', { headers: corsHeaders })
}
```

Create `supabase/functions/_shared/http.ts`:

```ts
import { corsHeaders } from './cors.ts'

export interface FunctionErrorBody {
  ok: false
  error: {
    code: string
    message: string
  }
}

export interface FunctionSuccessBody<T> {
  ok: true
  data: T
}

export function jsonSuccess<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, data } satisfies FunctionSuccessBody<T>), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

export function jsonError(code: string, message: string, status = 400): Response {
  return new Response(JSON.stringify({ ok: false, error: { code, message } } satisfies FunctionErrorBody), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
```

Create `supabase/functions/_shared/validation.ts`:

```ts
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const MAX_FILES_PER_SHARE = 20
export const MAX_FILENAME_LENGTH = 120

const BLOCKED_FILE_EXTENSIONS = new Set(['.exe', '.msi', '.bat', '.cmd', '.com', '.scr', '.ps1', '.vbs', '.js', '.jar', '.app', '.deb', '.rpm'])

export interface ShareManifestItem {
  safeName: string
  storageName: string
  size: number
  type: string
}

export type EdgeValidationResult = { ok: true } | { ok: false; code: string; filename?: string }

export function getEnvInt(value: string | undefined, fallback: number, min: number, max: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return fallback
  return parsed
}

export function isAdminSecretValid(expectedSecret: string | undefined, receivedSecret: string | null): boolean {
  if (!expectedSecret || !receivedSecret) return false
  return expectedSecret === receivedSecret
}

export function getFileExtension(filename: string): string {
  const index = filename.lastIndexOf('.')
  if (index <= 0 || index === filename.length - 1) return ''
  return filename.slice(index).toLowerCase()
}

export function validateShareManifestPayload(payload: unknown): EdgeValidationResult {
  if (!payload || typeof payload !== 'object') return { ok: false, code: 'INVALID_PAYLOAD' }
  const files = (payload as { files?: unknown }).files
  if (!Array.isArray(files) || files.length === 0) return { ok: false, code: 'NO_FILES' }
  if (files.length > MAX_FILES_PER_SHARE) return { ok: false, code: 'TOO_MANY_FILES' }

  let totalSize = 0
  for (const file of files) {
    if (!file || typeof file !== 'object') return { ok: false, code: 'INVALID_FILE' }
    const item = file as Partial<ShareManifestItem>
    if (typeof item.safeName !== 'string' || typeof item.storageName !== 'string') return { ok: false, code: 'INVALID_FILE' }
    if (typeof item.size !== 'number' || item.size < 0) return { ok: false, code: 'INVALID_FILE' }
    if (item.safeName.length > MAX_FILENAME_LENGTH) return { ok: false, code: 'FILENAME_TOO_LONG', filename: item.safeName }
    if (BLOCKED_FILE_EXTENSIONS.has(getFileExtension(item.safeName))) return { ok: false, code: 'BLOCKED_FILE_TYPE', filename: item.safeName }
    if (!/^file_\d+(\.[a-z0-9]+)?$/i.test(item.storageName)) return { ok: false, code: 'INVALID_STORAGE_NAME', filename: item.storageName }
    totalSize += item.size
  }

  if (totalSize > MAX_UPLOAD_BYTES) return { ok: false, code: 'TOTAL_SIZE_EXCEEDED' }
  return { ok: true }
}
```

Create `supabase/functions/_shared/supabase.ts`:

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.107.0'

export function createServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service environment is not configured')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  })
}
```

- [ ] **Step 4: Run shared Edge tests**

Run:

```bash
corepack pnpm vitest supabase/functions/_shared/validation.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Commit Edge shared utilities**

Run:

```bash
git add vitest.workspace.ts supabase/functions/_shared
git commit -m "feat: add shared edge function utilities"
```

---

## Task 3: Share Session, Finalize, and Cleanup Edge Functions

**Files:**
- Create: `supabase/functions/share-session/index.ts`
- Create: `supabase/functions/share-finalize/index.ts`
- Create: `supabase/functions/share-cleanup/index.ts`

- [ ] **Step 1: Implement `share-session`**

Create `supabase/functions/share-session/index.ts`:

```ts
import { handleCors } from '../_shared/cors.ts'
import { jsonError, jsonSuccess } from '../_shared/http.ts'
import { createServiceClient } from '../_shared/supabase.ts'
import { validateShareManifestPayload, type ShareManifestItem } from '../_shared/validation.ts'

interface ShareSessionRequest {
  fileName: string
  shareUrl: string
  files: ShareManifestItem[]
}

Deno.serve(async (request) => {
  const cors = handleCors(request)
  if (cors) return cors
  if (request.method !== 'POST') return jsonError('METHOD_NOT_ALLOWED', 'Method not allowed', 405)

  try {
    const body = (await request.json()) as ShareSessionRequest
    const validation = validateShareManifestPayload(body)
    if (!validation.ok) return jsonError(validation.code, validation.filename || validation.code, 400)

    const supabase = createServiceClient()
    const shareId = crypto.randomUUID()
    const storagePrefix = shareId
    const expiresInDays = Number.parseInt(Deno.env.get('SHARE_EXPIRY_DAYS') || '30', 10)
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    const totalSize = body.files.reduce((sum, file) => sum + file.size, 0)

    const { error: insertError } = await supabase.from('qr_files_log').insert({
      id: shareId,
      file_name: body.fileName || 'archive.zip',
      file_url: body.shareUrl.includes('?') ? `${body.shareUrl}&id=${shareId}` : `${body.shareUrl}?id=${shareId}`,
      file_size: totalSize,
      files_list: body.files.map((file) => file.safeName),
      status: 'pending',
      expires_at: expiresAt,
      storage_prefix: storagePrefix
    })

    if (insertError) return jsonError('DB_INSERT_FAILED', 'Unable to create share session', 500)

    const uploadTargets = []
    for (const file of body.files) {
      const path = `${storagePrefix}/${file.storageName}`
      const { data, error } = await supabase.storage.from('qr-files').createSignedUploadUrl(path)
      if (error || !data) {
        await supabase.from('qr_files_log').update({ status: 'failed' }).eq('id', shareId)
        return jsonError('SIGNED_UPLOAD_FAILED', 'Unable to create upload target', 500)
      }
      uploadTargets.push({ index: body.files.indexOf(file), path: data.path, token: data.token })
    }

    return jsonSuccess({ shareId, storagePrefix, expiresAt, uploadTargets })
  } catch (_error) {
    return jsonError('INVALID_REQUEST', 'Unable to create share session', 400)
  }
})
```

- [ ] **Step 2: Implement `share-finalize`**

Create `supabase/functions/share-finalize/index.ts`:

```ts
import { handleCors } from '../_shared/cors.ts'
import { jsonError, jsonSuccess } from '../_shared/http.ts'
import { createServiceClient } from '../_shared/supabase.ts'
import { validateShareManifestPayload, type ShareManifestItem } from '../_shared/validation.ts'

interface ShareFinalizeRequest {
  shareId: string
  files: ShareManifestItem[]
}

Deno.serve(async (request) => {
  const cors = handleCors(request)
  if (cors) return cors
  if (request.method !== 'POST') return jsonError('METHOD_NOT_ALLOWED', 'Method not allowed', 405)

  try {
    const body = (await request.json()) as ShareFinalizeRequest
    const validation = validateShareManifestPayload(body)
    if (!validation.ok) return jsonError(validation.code, validation.filename || validation.code, 400)
    if (!body.shareId) return jsonError('INVALID_SHARE_ID', 'Invalid share ID', 400)

    const supabase = createServiceClient()
    const { data: row, error: rowError } = await supabase
      .from('qr_files_log')
      .select('id, storage_prefix, status, file_url')
      .eq('id', body.shareId)
      .maybeSingle()

    if (rowError || !row) return jsonError('SESSION_NOT_FOUND', 'Share session not found', 404)
    if (row.status !== 'pending') return jsonError('SESSION_NOT_PENDING', 'Share session is not pending', 409)

    const { data: storageFiles, error: listError } = await supabase.storage.from('qr-files').list(row.storage_prefix)
    if (listError) return jsonError('STORAGE_LIST_FAILED', 'Unable to verify uploaded files', 500)

    const uploadedNames = new Set((storageFiles || []).map((file) => file.name))
    const missingFile = body.files.find((file) => !uploadedNames.has(file.storageName))
    if (missingFile) return jsonError('UPLOAD_INCOMPLETE', `Missing uploaded file: ${missingFile.safeName}`, 400)

    const { error: updateError } = await supabase
      .from('qr_files_log')
      .update({ status: 'ready', updated_at: new Date().toISOString() })
      .eq('id', body.shareId)

    if (updateError) return jsonError('FINALIZE_FAILED', 'Unable to finalize share session', 500)
    return jsonSuccess({ shareId: body.shareId, shareUrl: row.file_url })
  } catch (_error) {
    return jsonError('INVALID_REQUEST', 'Unable to finalize share session', 400)
  }
})
```

- [ ] **Step 3: Implement `share-cleanup`**

Create `supabase/functions/share-cleanup/index.ts`:

```ts
import { handleCors } from '../_shared/cors.ts'
import { jsonError, jsonSuccess } from '../_shared/http.ts'
import { createServiceClient } from '../_shared/supabase.ts'

Deno.serve(async (request) => {
  const cors = handleCors(request)
  if (cors) return cors
  if (request.method !== 'POST') return jsonError('METHOD_NOT_ALLOWED', 'Method not allowed', 405)

  try {
    const body = (await request.json()) as { shareId?: string }
    if (!body.shareId) return jsonError('INVALID_SHARE_ID', 'Invalid share ID', 400)

    const supabase = createServiceClient()
    const { data: row } = await supabase
      .from('qr_files_log')
      .select('id, storage_prefix')
      .eq('id', body.shareId)
      .maybeSingle()

    if (!row) return jsonSuccess({ cleaned: false })

    const { data: storageFiles } = await supabase.storage.from('qr-files').list(row.storage_prefix)
    const paths = (storageFiles || []).map((file) => `${row.storage_prefix}/${file.name}`)
    if (paths.length > 0) await supabase.storage.from('qr-files').remove(paths)

    await supabase.from('qr_files_log').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', body.shareId)
    return jsonSuccess({ cleaned: true })
  } catch (_error) {
    return jsonError('CLEANUP_FAILED', 'Unable to clean up failed upload', 500)
  }
})
```

- [ ] **Step 4: Run TypeScript-adjacent tests**

Run:

```bash
corepack pnpm vitest supabase/functions/_shared/validation.test.ts --run
```

Expected: PASS. Full Deno runtime verification happens during Supabase deployment testing.

- [ ] **Step 5: Commit share Edge Functions**

Run:

```bash
git add supabase/functions/share-session supabase/functions/share-finalize supabase/functions/share-cleanup
git commit -m "feat: add share edge functions"
```

---

## Task 4: Admin Edge Function

**Files:**
- Create: `supabase/functions/admin-shares/index.ts`

- [ ] **Step 1: Implement `admin-shares`**

Create `supabase/functions/admin-shares/index.ts`:

```ts
import { handleCors } from '../_shared/cors.ts'
import { jsonError, jsonSuccess } from '../_shared/http.ts'
import { createServiceClient } from '../_shared/supabase.ts'
import { isAdminSecretValid } from '../_shared/validation.ts'

type AdminAction =
  | { action: 'list' }
  | { action: 'create'; fileName: string; fileUrl: string; fileSize: number; filesList: string[] }
  | { action: 'update'; id: string; fileName: string }
  | { action: 'delete'; id: string }

Deno.serve(async (request) => {
  const cors = handleCors(request)
  if (cors) return cors
  if (request.method !== 'POST') return jsonError('METHOD_NOT_ALLOWED', 'Method not allowed', 405)

  const expectedSecret = Deno.env.get('ADMIN_SECRET')
  const receivedSecret = request.headers.get('x-admin-secret')
  if (!isAdminSecretValid(expectedSecret, receivedSecret)) return jsonError('UNAUTHORIZED', 'Unauthorized', 401)

  try {
    const body = (await request.json()) as AdminAction
    const supabase = createServiceClient()

    if (body.action === 'list') {
      const { data, error } = await supabase.from('qr_files_log').select('*').order('created_at', { ascending: false })
      if (error) return jsonError('ADMIN_LIST_FAILED', 'Unable to load share history', 500)
      return jsonSuccess({ logs: data || [] })
    }

    if (body.action === 'create') {
      const id = crypto.randomUUID()
      const { data, error } = await supabase
        .from('qr_files_log')
        .insert({
          id,
          file_name: body.fileName,
          file_url: body.fileUrl,
          file_size: body.fileSize,
          files_list: body.filesList.length > 0 ? body.filesList : [body.fileName],
          status: 'ready',
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          storage_prefix: id
        })
        .select('*')
        .single()
      if (error) return jsonError('ADMIN_CREATE_FAILED', 'Unable to create share record', 500)
      return jsonSuccess({ log: data })
    }

    if (body.action === 'update') {
      const cleanName = body.fileName.trim()
      if (!cleanName) return jsonError('INVALID_FILE_NAME', 'File name is required', 400)
      const { data, error } = await supabase
        .from('qr_files_log')
        .update({ file_name: cleanName, updated_at: new Date().toISOString() })
        .eq('id', body.id)
        .select('*')
        .single()
      if (error) return jsonError('ADMIN_UPDATE_FAILED', 'Unable to update share record', 500)
      return jsonSuccess({ log: data })
    }

    if (body.action === 'delete') {
      const { data: row } = await supabase.from('qr_files_log').select('id, storage_prefix').eq('id', body.id).maybeSingle()
      if (!row) return jsonError('NOT_FOUND', 'Share record not found', 404)

      const { data: storageFiles, error: listError } = await supabase.storage.from('qr-files').list(row.storage_prefix)
      if (listError) return jsonError('STORAGE_LIST_FAILED', 'Unable to list storage files', 500)

      const paths = (storageFiles || []).map((file) => `${row.storage_prefix}/${file.name}`)
      if (paths.length > 0) {
        const { error: removeError } = await supabase.storage.from('qr-files').remove(paths)
        if (removeError) return jsonError('STORAGE_DELETE_FAILED', 'Unable to delete every storage file', 500)
      }

      const { error: updateError } = await supabase
        .from('qr_files_log')
        .update({ status: 'deleted', updated_at: new Date().toISOString() })
        .eq('id', body.id)
      if (updateError) return jsonError('ADMIN_DELETE_FAILED', 'Unable to delete share record', 500)
      return jsonSuccess({ deleted: true })
    }

    return jsonError('INVALID_ACTION', 'Invalid admin action', 400)
  } catch (_error) {
    return jsonError('INVALID_REQUEST', 'Invalid admin request', 400)
  }
})
```

- [ ] **Step 2: Run shared validation tests**

Run:

```bash
corepack pnpm vitest supabase/functions/_shared/validation.test.ts --run
```

Expected: PASS.

- [ ] **Step 3: Commit admin Edge Function**

Run:

```bash
git add supabase/functions/admin-shares
git commit -m "feat: add admin shares edge function"
```

---

## Task 5: Frontend Share API Client

**Files:**
- Modify: `src/utils/supabase.ts`
- Create: `src/utils/shareApi.ts`
- Create: `src/utils/shareApi.test.ts`

- [ ] **Step 1: Write failing share API tests**

Create `src/utils/shareApi.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { parseFunctionResponse } from './shareApi'

describe('shareApi', () => {
  it('parses successful function responses', async () => {
    const response = new Response(JSON.stringify({ ok: true, data: { id: 'abc' } }), { status: 200 })
    await expect(parseFunctionResponse(response)).resolves.toEqual({ id: 'abc' })
  })

  it('throws user-safe function errors', async () => {
    const response = new Response(JSON.stringify({ ok: false, error: { code: 'NO_FILES', message: 'เลือกไฟล์' } }), { status: 400 })
    await expect(parseFunctionResponse(response)).rejects.toMatchObject({ code: 'NO_FILES', message: 'เลือกไฟล์' })
  })

  it('throws UNKNOWN for invalid JSON', async () => {
    const response = new Response('not-json', { status: 500 })
    await expect(parseFunctionResponse(response)).rejects.toMatchObject({ code: 'UNKNOWN' })
  })
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
corepack pnpm vitest src/utils/shareApi.test.ts --run
```

Expected: FAIL because `src/utils/shareApi.ts` does not exist.

- [ ] **Step 3: Export Supabase URL and anon key**

Modify `src/utils/supabase.ts` to:

```ts
import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any
```

- [ ] **Step 4: Implement share API client**

Create `src/utils/shareApi.ts`:

```ts
import { supabase, supabaseAnonKey, supabaseUrl } from './supabase'
import type { SafeFileManifestItem } from './fileShareValidation'

export interface FunctionError extends Error {
  code: string
}

export interface ShareSessionResponse {
  shareId: string
  storagePrefix: string
  expiresAt: string
  uploadTargets: Array<{ index: number; path: string; token: string }>
}

export interface ShareFinalizeResponse {
  shareId: string
  shareUrl: string
}

function functionUrl(name: string): string {
  return `${supabaseUrl}/functions/v1/${name}`
}

export async function parseFunctionResponse<T>(response: Response): Promise<T> {
  try {
    const body = await response.json()
    if (body?.ok === true) return body.data as T
    const error = new Error(body?.error?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง') as FunctionError
    error.code = body?.error?.code || 'UNKNOWN'
    throw error
  } catch (err) {
    if ((err as FunctionError).code) throw err
    const error = new Error('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง') as FunctionError
    error.code = 'UNKNOWN'
    throw error
  }
}

async function callFunction<T>(name: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  const response = await fetch(functionUrl(name), {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify(body)
  })
  return parseFunctionResponse<T>(response)
}

export function createShareSession(input: { fileName: string; shareUrl: string; files: SafeFileManifestItem[] }) {
  return callFunction<ShareSessionResponse>('share-session', input)
}

export function finalizeShareSession(input: { shareId: string; files: SafeFileManifestItem[] }) {
  return callFunction<ShareFinalizeResponse>('share-finalize', input)
}

export function cleanupShareSession(shareId: string) {
  return callFunction<{ cleaned: boolean }>('share-cleanup', { shareId })
}

export async function uploadFileToSignedTarget(path: string, token: string, file: File) {
  const { error } = await supabase.storage.from('qr-files').uploadToSignedUrl(path, token, file, {
    cacheControl: '3600',
    upsert: false
  })
  if (error) throw error
}

export function callAdminShares<T>(adminSecret: string, body: unknown) {
  return callFunction<T>('admin-shares', body, { 'x-admin-secret': adminSecret })
}
```

- [ ] **Step 5: Run share API tests**

Run:

```bash
corepack pnpm vitest src/utils/shareApi.test.ts --run
```

Expected: PASS.

- [ ] **Step 6: Commit frontend API client**

Run:

```bash
git add src/utils/supabase.ts src/utils/shareApi.ts src/utils/shareApi.test.ts
git commit -m "feat: add share edge function client"
```

---

## Task 6: Replace File Upload Flow in `InlineDataTemplates.vue`

**Files:**
- Modify: `src/components/InlineDataTemplates.vue`

- [ ] **Step 1: Add imports**

Add these imports near existing utility imports:

```ts
import {
  buildSafeFileManifest,
  mapShareErrorMessage,
  validateFileManifest
} from '@/utils/fileShareValidation'
import {
  cleanupShareSession,
  createShareSession,
  finalizeShareSession,
  uploadFileToSignedTarget
} from '@/utils/shareApi'
```

- [ ] **Step 2: Add public notice state**

Add near file upload state refs:

```ts
const publicShareNoticeAccepted = ref(false)
```

- [ ] **Step 3: Replace upload workflow**

Replace the body of `handleFileUploadWorkflow` with this function body:

```ts
const handleFileUploadWorkflow = async () => {
  if (!isSupabaseConfigured) {
    uploadError.value = mapShareErrorMessage('SUPABASE_NOT_CONFIGURED')
    return
  }

  const files = filesToUpload.value.map(item => item.file)
  const validation = validateFileManifest(files)
  if (!validation.ok) {
    uploadError.value = mapShareErrorMessage(validation.code, validation.filename)
    return
  }

  if (!publicShareNoticeAccepted.value) {
    uploadError.value = t('กรุณายืนยันว่าเข้าใจว่าไฟล์จะถูกแชร์ผ่านลิงก์สาธารณะ') || 'กรุณายืนยันว่าเข้าใจว่าไฟล์จะถูกแชร์ผ่านลิงก์สาธารณะ'
    return
  }

  uploading.value = true
  uploadError.value = ''
  uploadSuccess.value = false
  uploadProgressPercent.value = 0

  let createdShareId = ''

  try {
    const manifest = buildSafeFileManifest(files)
    if (!manifest.ok) {
      uploadError.value = mapShareErrorMessage(manifest.code, manifest.filename)
      return
    }

    let cleanCustomName = customZipName.value.trim().replace(/[\\/:*?"<>|]/g, '')
    if (cleanCustomName) {
      if (!cleanCustomName.toLowerCase().endsWith('.zip')) cleanCustomName += '.zip'
    } else {
      cleanCustomName = 'archive.zip'
    }

    const baseShareUrl = window.location.origin + window.location.pathname
    const session = await createShareSession({
      fileName: cleanCustomName,
      shareUrl: baseShareUrl,
      files: manifest.files
    })

    createdShareId = session.shareId

    for (const target of session.uploadTargets) {
      const manifestFile = manifest.files[target.index]
      const uploadItem = filesToUpload.value[target.index]
      currentUploadingFileIndex.value = target.index
      currentUploadingFileName.value = manifestFile.safeName
      uploadProgressPercent.value = Math.round((target.index / manifest.files.length) * 90)
      await uploadFileToSignedTarget(target.path, target.token, uploadItem.file)
    }

    uploadProgressPercent.value = 95
    const finalized = await finalizeShareSession({ shareId: session.shareId, files: manifest.files })

    uploadProgressPercent.value = 100
    uploadedShareUrl.value = finalized.shareUrl
    totalSizeUploaded.value = manifest.totalSize
    uploadedFilesCount.value = manifest.files.length
    uploadSuccess.value = true

    isUpdatingFromInside = true
    emit('update:modelValue', finalized.shareUrl)
    setTimeout(() => {
      isUpdatingFromInside = false
    }, 50)
  } catch (err: any) {
    if (createdShareId) await cleanupShareSession(createdShareId).catch(() => undefined)
    console.error('File upload failed:', err)
    uploadError.value = err?.code ? mapShareErrorMessage(err.code) : err?.message || t('การอัปโหลดล้มเหลว กรุณาลองใหม่อีกครั้ง')
  } finally {
    uploading.value = false
  }
}
```

- [ ] **Step 4: Add public-link notice UI before upload button**

Insert above the upload button in the file upload form:

```vue
<label class="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-[10px] leading-relaxed text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/20 dark:text-amber-200">
  <input
    v-model="publicShareNoticeAccepted"
    type="checkbox"
    class="mt-0.5 size-3.5 rounded border-amber-400 text-blue-600 focus:ring-blue-500"
    :disabled="uploading"
  />
  <span>
    {{ t('ฉันเข้าใจว่าไฟล์ที่อัปโหลดจะถูกแชร์ผ่านลิงก์สาธารณะ ผู้ที่มี QR Code หรือลิงก์สามารถดาวน์โหลดได้ และไม่ควรอัปโหลดข้อมูลลับหรือข้อมูลส่วนบุคคลที่อ่อนไหว') }}
  </span>
</label>
```

- [ ] **Step 5: Disable upload until notice is accepted**

Change the upload button `:disabled` expression to:

```vue
:disabled="uploading || !publicShareNoticeAccepted || filesToUpload.reduce((acc, f) => acc + f.file.size, 0) > 10 * 1024 * 1024"
```

- [ ] **Step 6: Run build-focused checks**

Run:

```bash
corepack pnpm vitest src/utils/fileShareValidation.test.ts src/utils/shareApi.test.ts --run
corepack pnpm type-check
```

Expected: tests PASS and type-check exits 0.

- [ ] **Step 7: Commit upload flow migration**

Run:

```bash
git add src/components/InlineDataTemplates.vue
git commit -m "feat: route file uploads through share sessions"
```

---

## Task 7: Harden Share Page Loading

**Files:**
- Modify: `src/components/FileShareView.vue`

- [ ] **Step 1: Add imports and state helpers**

Add import:

```ts
import { isValidShareId, mapShareErrorMessage } from '@/utils/fileShareValidation'
```

In `fetchShareDetails`, before Supabase checks, add:

```ts
if (!isValidShareId(props.shareId)) {
  error.value = mapShareErrorMessage('INVALID_SHARE_ID')
  loading.value = false
  return
}
```

- [ ] **Step 2: Filter invalid lifecycle states**

After `if (!data) { ... return }`, add:

```ts
const isExpired = data.expires_at && new Date(data.expires_at).getTime() < Date.now()
if (data.status && data.status !== 'ready') {
  error.value = t('ลิงก์แชร์นี้ยังไม่พร้อมใช้งาน หรือถูกปิดไปแล้ว') || 'ลิงก์แชร์นี้ยังไม่พร้อมใช้งาน หรือถูกปิดไปแล้ว'
  return
}
if (isExpired) {
  error.value = mapShareErrorMessage('SESSION_EXPIRED')
  return
}
```

- [ ] **Step 3: Use `storage_prefix` where available**

Replace storage path uses of `props.shareId` with:

```ts
const storagePrefix = shareData.value?.storage_prefix || props.shareId
```

Use `storagePrefix` for `list`, `download`, and `getPublicUrl` paths.

- [ ] **Step 4: Run type-check**

Run:

```bash
corepack pnpm type-check
```

Expected: PASS.

- [ ] **Step 5: Commit share page hardening**

Run:

```bash
git add src/components/FileShareView.vue
git commit -m "fix: harden file share page states"
```

---

## Task 8: Replace Admin Direct Supabase Mutations

**Files:**
- Modify: `src/components/AdminHistoryModal.vue`

- [ ] **Step 1: Replace imports**

Remove direct Supabase import:

```ts
import { supabase, isSupabaseConfigured } from '@/utils/supabase'
```

Add:

```ts
import { callAdminShares } from '@/utils/shareApi'
import { mapShareErrorMessage } from '@/utils/fileShareValidation'
```

- [ ] **Step 2: Replace local password comparison login**

Replace `handleLogin` with:

```ts
const handleLogin = async () => {
  if (!password.value) {
    authError.value = true
    return
  }

  try {
    authError.value = false
    loading.value = true
    const result = await callAdminShares<{ logs: any[] }>(password.value, { action: 'list' })
    logs.value = result.logs
    isAuthenticated.value = true
  } catch (err: any) {
    authError.value = true
    dbError.value = err?.code === 'UNAUTHORIZED' ? mapShareErrorMessage('UNAUTHORIZED') : err?.message || 'Admin login failed.'
    password.value = ''
  } finally {
    loading.value = false
  }
}
```

- [ ] **Step 3: Replace `fetchHistoryLogs`**

Replace direct Supabase select with:

```ts
const fetchHistoryLogs = async () => {
  loading.value = true
  dbError.value = ''
  try {
    const result = await callAdminShares<{ logs: any[] }>(password.value, { action: 'list' })
    logs.value = result.logs
  } catch (err: any) {
    dbError.value = err?.message || 'Failed to load share history.'
  } finally {
    loading.value = false
  }
}
```

- [ ] **Step 4: Replace delete/update/create actions**

Replace the mutation portions with these calls:

```ts
await callAdminShares<{ deleted: boolean }>(password.value, { action: 'delete', id: row.id })
logs.value = logs.value.filter(item => item.id !== row.id)
```

```ts
const result = await callAdminShares<{ log: any }>(password.value, {
  action: 'update',
  id: row.id,
  fileName: cleanName
})
row.file_name = result.log.file_name
editingRowId.value = null
```

```ts
const result = await callAdminShares<{ log: any }>(password.value, {
  action: 'create',
  fileName: name,
  fileUrl: url,
  fileSize: size,
  filesList: list.length > 0 ? list : [name]
})
logs.value.unshift(result.log)
```

- [ ] **Step 5: Run type-check**

Run:

```bash
corepack pnpm type-check
```

Expected: PASS.

- [ ] **Step 6: Commit admin frontend migration**

Run:

```bash
git add src/components/AdminHistoryModal.vue
git commit -m "fix: move admin actions behind edge function"
```

---

## Task 9: Production SQL and Deployment Docs

**Files:**
- Create: `docs/supabase_production_setup.sql`
- Create: `docs/production-deployment-checklist.md`
- Modify: `docs/supabase_setup.sql`
- Modify: `.env.example`

- [ ] **Step 1: Create production SQL setup**

Create `docs/supabase_production_setup.sql`:

```sql
-- Production Supabase Setup for MiniQR File Sharing

CREATE TABLE IF NOT EXISTS public.qr_files_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    files_list TEXT[] NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed', 'deleted')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()) + interval '30 days',
    storage_prefix TEXT NOT NULL
);

ALTER TABLE public.qr_files_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insert" ON public.qr_files_log;
DROP POLICY IF EXISTS "Allow public select" ON public.qr_files_log;
DROP POLICY IF EXISTS "Allow public delete" ON public.qr_files_log;
DROP POLICY IF EXISTS "Allow public update" ON public.qr_files_log;

CREATE POLICY "Allow public ready share select" ON public.qr_files_log
    FOR SELECT TO anon
    USING (
        status = 'ready'
        AND expires_at > timezone('utc'::text, now())
    );

CREATE INDEX IF NOT EXISTS qr_files_log_status_expires_idx
    ON public.qr_files_log (status, expires_at);

-- Create the public storage bucket once if helper access is available.
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('qr-files', 'qr-files', true)
-- ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Allow public storage upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow public storage select" ON storage.objects;
DROP POLICY IF EXISTS "Allow public storage delete" ON storage.objects;

CREATE POLICY "Allow public storage read" ON storage.objects
    FOR SELECT TO anon
    USING (bucket_id = 'qr-files');
```

- [ ] **Step 2: Mark old setup as development-only**

At the top of `docs/supabase_setup.sql`, add:

```sql
-- DEVELOPMENT-ONLY SETUP
-- This broad policy setup is convenient for local testing but is not safe for public production.
-- For production, use docs/supabase_production_setup.sql and Supabase Edge Functions.
```

- [ ] **Step 3: Update `.env.example`**

Append:

```dotenv
# Admin secrets are intentionally not VITE_* variables.
# Configure ADMIN_SECRET in Supabase Edge Function secrets instead.
# Example:
# supabase secrets set ADMIN_SECRET="change-this-long-random-secret"
```

- [ ] **Step 4: Create deployment checklist**

Create `docs/production-deployment-checklist.md`:

```md
# MiniQR Production Deployment Checklist

## Supabase

- Apply `docs/supabase_production_setup.sql` in the Supabase SQL editor.
- Confirm bucket `qr-files` exists and is public-read.
- Confirm anonymous users cannot insert, update, or delete `qr_files_log` rows.
- Confirm anonymous users cannot delete `qr-files` storage objects.
- Set Edge Function secrets:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ADMIN_SECRET`
  - `SHARE_EXPIRY_DAYS`

## Edge Functions

Deploy:

```bash
supabase functions deploy share-session
supabase functions deploy share-finalize
supabase functions deploy share-cleanup
supabase functions deploy admin-shares
```

## Frontend

- Set `VITE_SUPABASE_URL`.
- Set `VITE_SUPABASE_ANON_KEY`.
- Do not set `VITE_ADMIN_PASSWORD` for production authorization.
- Run `corepack pnpm build`.
- Test upload, share page, admin list, admin update, and admin delete with the production domain.

## Verification

- Upload rejects blocked file extensions.
- Upload rejects total size above 10 MB.
- Upload shows public-link warning.
- Invalid share IDs show a safe error.
- Expired/deleted share records are not visible publicly.
- Admin actions fail with a wrong secret and succeed with the configured secret.
```

- [ ] **Step 5: Commit production docs**

Run:

```bash
git add docs/supabase_production_setup.sql docs/production-deployment-checklist.md docs/supabase_setup.sql .env.example
git commit -m "docs: add production supabase setup"
```

---

## Task 10: Package Manager and Hook Consistency

**Files:**
- Modify: `playwright.config.ts`
- Modify: `.husky/pre-commit`

- [ ] **Step 1: Update Playwright web server command**

In `playwright.config.ts`, change:

```ts
command: 'npm run dev',
```

to:

```ts
command: 'corepack pnpm dev',
```

- [ ] **Step 2: Update Husky hook**

In `.husky/pre-commit`, change:

```sh
pnpm lint-staged
```

to:

```sh
corepack pnpm lint-staged
```

- [ ] **Step 3: Run verification**

Run:

```bash
corepack pnpm vitest src/utils/fileShareValidation.test.ts src/utils/shareApi.test.ts supabase/functions/_shared/validation.test.ts --run
corepack pnpm type-check
corepack pnpm build
```

Expected: all commands exit 0.

- [ ] **Step 4: Commit package-manager consistency**

Run:

```bash
git add playwright.config.ts .husky/pre-commit
git commit -m "chore: align tooling with corepack pnpm"
```

---

## Task 11: Final Full Verification

**Files:**
- No new files expected.

- [ ] **Step 1: Check working tree**

Run:

```bash
git status --short
```

Expected: no output.

- [ ] **Step 2: Run unit and build checks**

Run:

```bash
corepack pnpm vitest --run
corepack pnpm type-check
corepack pnpm build
```

Expected: all commands exit 0.

- [ ] **Step 3: Run E2E smoke test when browser dependencies are available**

Run:

```bash
corepack pnpm test:e2e
```

Expected: PASS. If Playwright browser dependencies are missing on the machine, record the exact missing dependency message and run E2E after installing browsers through the project-approved Playwright setup.

- [ ] **Step 4: Manual browser smoke test**

Run the dev server:

```bash
corepack pnpm dev -- --host 127.0.0.1
```

Open `http://localhost:5173/` and verify:

- QR creation still renders.
- Scan mode still opens.
- File upload form shows public-link notice.
- Upload button is disabled until the notice checkbox is checked.
- Invalid share link `http://localhost:5173/?id=not-a-uuid` shows a friendly error.

- [ ] **Step 5: Record verification results**

If verification reveals a production checklist correction, update `docs/production-deployment-checklist.md` and run:

```bash
git add docs/production-deployment-checklist.md
git commit -m "docs: update production verification notes"
```

If verification does not require checklist changes, run:

```bash
git status --short
```

Expected: no output. Do not create an empty commit.

---

## Self-Review Against Spec

### Spec coverage

- Supabase database and storage permissions: covered by Task 9.
- File sharing upload validation and cleanup: covered by Tasks 1, 2, 3, 5, and 6.
- Admin operations behind server boundary: covered by Tasks 4 and 8.
- Public-link privacy notice: covered by Task 6.
- Share invalid/expired/deleted handling: covered by Task 7.
- Test and deployment consistency: covered by Tasks 2, 9, 10, and 11.

### Type consistency

- Frontend manifest type: `SafeFileManifestItem` in `src/utils/fileShareValidation.ts`.
- Edge manifest type: `ShareManifestItem` in `supabase/functions/_shared/validation.ts`.
- Function names: `share-session`, `share-finalize`, `share-cleanup`, `admin-shares`.
- Admin secret header: `x-admin-secret`.
- Share lifecycle fields: `status`, `expires_at`, `updated_at`, `storage_prefix`.

### Risk notes for implementation workers

- Supabase Edge Function files use `.ts` imports with Deno-style `.ts` extensions inside `supabase/functions`.
- Vitest can test pure shared Edge validation but does not fully execute the Deno runtime path.
- The production SQL intentionally removes anonymous insert/update/delete for `qr_files_log` and anonymous delete for storage.
- Signed upload URLs require Supabase Storage support from the installed Supabase JS version; this project already uses `@supabase/supabase-js` `^2.107.0`.
