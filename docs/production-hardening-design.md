# MiniQR Production Hardening Design

## Status

Approved for specification by the project owner on 2026-06-09.

## Goal

Prepare MiniQR for safer public production use while preserving the current product direction: a premium municipal QR generator with QR creation, scanning, and multi-file sharing through Supabase.

The first hardening phase focuses on the highest-risk public release areas:

- Supabase database and storage permissions.
- File sharing upload validation and cleanup.
- Admin operations currently guarded only by client-side password logic.
- User-facing privacy and failure-state clarity.
- Test and deployment consistency.

## Non-goals for this phase

- Replacing Supabase with another backend.
- Implementing full Supabase Auth email login for administrators.
- Adding antivirus or malware scanning.
- Adding billing, per-user accounts, or paid quotas.
- Rewriting the app routing system from query-based share links to route-based share pages.
- Changing the selected file sharing model from individual file upload to single pre-upload zip.

## Current risks being addressed

### Supabase permissions are too broad

The current setup document allows anonymous users to insert, select, update, and delete `qr_files_log` rows. It also allows anonymous upload and delete access for the `qr-files` bucket. This is convenient for development but unsafe for public deployment.

### Admin authorization is not a security boundary

The admin modal checks a password in frontend code. A `VITE_*` password is bundled into static assets and can be inspected by users. Admin delete, create, and update operations must move behind a server-side boundary.

### Upload constraints are mostly client-side

The UI enforces a 10 MB total upload limit, but client-side checks can be bypassed if storage policies permit direct writes. Production validation must be repeated in Supabase Edge Functions.

### Partial upload failures can leave orphaned files

The current flow uploads files first and inserts metadata afterward. If metadata creation fails after storage uploads complete, orphaned storage objects can remain.

### Public file sharing needs explicit user notice

The product intentionally creates public share links. Before public release, the UI must clearly tell users that anyone with the link or QR code can download the uploaded files.

## Selected architecture

Use Supabase Edge Functions as the production security boundary.

The Vue frontend remains a static Vite application. It continues to render QR codes, scan QR codes, collect files, and upload individual files. Privileged or security-sensitive operations move to Edge Functions.

### Frontend responsibilities

- Render QR creation, scanning, file selection, and share-page UI.
- Perform immediate client-side validation for file count, total size, filename safety, and unsupported file extensions.
- Show privacy and public-link notices before upload.
- Call Edge Functions for share session creation, metadata finalization, and admin actions.
- Upload individual files only after a share session has been created.
- Show friendly Thai/English error states for upload, missing Supabase configuration, expired share links, and admin failures.

### Edge Function responsibilities

- Validate all incoming request payloads.
- Enforce production upload limits independently of the UI.
- Create share sessions and metadata using server-side privileges.
- Finalize share sessions only after the frontend reports upload completion.
- Roll back or mark failed sessions when finalization fails.
- Execute admin list, create, update, and delete operations only when the request includes a valid admin secret.
- Delete storage objects during admin delete operations.
- Avoid returning service-role secrets, internal stack traces, or unnecessary database details to the browser.

### Supabase database responsibilities

- Store share metadata in `qr_files_log`.
- Track share status so public users only see ready, active records.
- Track expiration and cleanup state.

### Supabase storage responsibilities

- Store uploaded files under a share-specific folder path.
- Allow public reads for downloadable files.
- Avoid anonymous delete.
- Avoid unrestricted anonymous writes.
- Use signed upload URLs created by an Edge Function for browser uploads.

## Data model

The existing `qr_files_log` table remains the main public metadata table. The production-ready version must support the current fields and add lifecycle fields.

### Existing fields

- `id`: UUID primary key and share ID.
- `created_at`: creation timestamp.
- `file_name`: default download zip name.
- `file_url`: public share URL.
- `file_size`: total file size in bytes.
- `files_list`: original user-facing filenames.

### New lifecycle fields

- `status`: one of `pending`, `ready`, `failed`, `deleted`.
- `expires_at`: expiration timestamp, defaulting to 30 days after creation unless overridden by deployment configuration.
- `updated_at`: last update timestamp.
- `storage_prefix`: storage folder prefix, normally equal to the share ID.

Public share pages must only load records where `status = 'ready'` and the record is not expired or deleted.

## File sharing flow

The production flow keeps the current individual-file upload model.

1. User selects files or creates a text note.
2. Frontend validates:
   - at least one file;
   - total size not above configured limit, initially 10 MB;
   - file count not above configured limit, initially 20 files;
   - filename after sanitization is not empty;
   - extension is not in a blocked high-risk list.
3. User confirms the public-link notice.
4. Frontend calls `share-session` with sanitized metadata.
5. `share-session` validates the same limits, creates a `pending` record, and returns signed upload URLs for the expected storage paths.
6. Frontend uploads files using those signed upload URLs.
7. Frontend calls `share-finalize` with the uploaded file manifest.
8. Edge Function validates the manifest against the pending record and marks the record `ready`.
9. Frontend receives the final share URL and inserts it into the QR payload.
10. Share page loads the ready metadata and lets recipients download individual files or generate a zip client-side.

## Admin flow

The frontend admin modal remains available, but it no longer compares the admin password locally.

1. Admin enters the password in the UI.
2. The frontend sends the password to an Edge Function request in an `x-admin-secret` header.
3. The Edge Function compares it to the `ADMIN_SECRET` configured in Supabase secrets.
4. On success, the function performs the requested action.
5. On failure, the function returns a generic unauthorized response.

Admin actions in scope:

- List share records.
- Create manual share record.
- Update display filename.
- Delete share record and associated storage objects.

The admin secret must never be stored in `VITE_*` frontend environment variables.

## Production Supabase policy direction

The production SQL must replace broad anonymous write policies.

### Database policy direction

- Allow anonymous select only for active, ready, non-expired records.
- Do not allow anonymous insert, update, or delete on `qr_files_log`.
- Use Edge Functions with service-role privileges for writes.

### Storage policy direction

- Allow public read for `qr-files` objects that must be downloadable by QR recipients.
- Do not allow anonymous delete.
- Uploads are mediated by signed upload URLs generated by `share-session`.
- Finalization must reject unexpected files and cleanup routines must remove abandoned objects.

## Edge Functions

The first hardening phase introduces these Supabase Edge Functions:

- `share-session`: creates a pending share record and signed upload URLs.
- `share-finalize`: validates uploaded file metadata and marks a pending share as ready.
- `share-cleanup`: marks a failed session and removes uploaded objects under its storage prefix.
- `admin-shares`: handles admin list, create, update, and delete actions after validating `x-admin-secret`.

Each function must return a stable JSON response shape:

```json
{
  "ok": true,
  "data": {}
}
```

or:

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "User-safe error message"
  }
}
```

## User-facing safety improvements

### Public file notice

The file upload UI must clearly state:

- Uploaded files will be accessible through a public link.
- Anyone with the QR code or link can download them.
- Users should not upload confidential, private, or sensitive personal data.
- The maximum total upload size is initially 10 MB.

### Better failure states

The app must map technical errors into clear messages:

- Supabase is not configured.
- Storage bucket or policy is missing.
- File is too large.
- File type is not allowed.
- Upload session expired or invalid.
- Share link not found, expired, or deleted.
- Admin password is incorrect.

## Validation policy

The first production validation policy is intentionally conservative.

### Limits

- Maximum files per share: 20.
- Maximum total size per share: 10 MB.
- Maximum filename length after sanitization: 120 characters.
- Empty sanitized filenames become safe generated names.

### Blocked extensions

The frontend and Edge Functions must block high-risk executable/script extensions, including:

- `.exe`
- `.msi`
- `.bat`
- `.cmd`
- `.com`
- `.scr`
- `.ps1`
- `.vbs`
- `.js`
- `.jar`
- `.app`
- `.deb`
- `.rpm`

This is not malware scanning. It is a basic public-upload safety guard.

## Cleanup and failure handling

### Upload creation failure

If the share-session function rejects the request, no storage upload should begin.

### File upload failure

If any file upload fails, the frontend must call `share-cleanup` when possible. The UI must show that the upload failed and ask the user to retry.

### Finalization failure

If finalization fails after storage uploads, the Edge Function must mark the session as `failed` and attempt to delete objects under the session prefix.

### Admin deletion

Admin delete must remove both metadata and all storage objects under the share prefix. If storage deletion partially fails, the UI must report the partial failure rather than silently claiming success.

## Testing strategy

### Unit tests

Add or update tests for:

- file validation limits;
- filename sanitization;
- blocked extension checks;
- share ID validation;
- user-friendly error mapping.

### Integration or function tests

Test Edge Function request validation with mocked Supabase clients. Local Supabase tooling may be used as an additional manual verification path.

### E2E tests

Maintain existing QR creation/scanning coverage. Add coverage for:

- Supabase not configured state;
- upload validation failure before network calls;
- share page not-found/invalid ID state;
- admin unauthorized state.

Full happy-path upload E2E can be gated behind a configured Supabase test environment.

### Command consistency

Playwright and documentation should use the project package manager consistently. In this environment, pnpm is invoked through Corepack:

```bash
corepack pnpm dev
corepack pnpm build
corepack pnpm vitest
corepack pnpm test:e2e
```

## Deployment requirements

### Frontend environment variables

The frontend should keep only public Vite variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- existing non-secret UI configuration variables

The frontend must not include `VITE_ADMIN_PASSWORD` for production admin authorization.

### Supabase Edge Function secrets

Supabase must define:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_SECRET`
- optional `MAX_UPLOAD_BYTES`
- optional `MAX_FILES_PER_SHARE`
- optional `SHARE_EXPIRY_DAYS`

### Release checklist

Before public release:

- Apply production SQL policies.
- Deploy Edge Functions.
- Configure Supabase secrets.
- Confirm bucket `qr-files` exists.
- Verify public share download works.
- Verify anonymous update/delete is blocked.
- Verify admin actions only work through Edge Functions.
- Run build and available tests.
- Test deployment with the final domain and base path.

## Rollout plan

### Phase 1: Production safety baseline

- Add shared validation utilities.
- Add public-link notice and friendly upload errors.
- Add Edge Function sources and deployment docs.
- Replace admin client-side password checks with Edge Function calls.
- Add production SQL policy documentation.
- Fix package-manager consistency in test configuration and docs.

### Phase 2: Stronger file lifecycle

- Add `status`, `expires_at`, `updated_at`, and `storage_prefix` fields.
- Add session finalization and cleanup behavior.
- Improve share page handling for expired and deleted links.

### Phase 3: Operational maturity

- Add scheduled cleanup for failed or expired shares.
- Add monitoring guidance for storage usage and upload failures.
- Add optional malware scanning or stricter content controls if public usage expands.

## Acceptance criteria

The production hardening phase is complete when:

- Admin password is no longer checked against a frontend-bundled value.
- Anonymous users cannot update or delete share metadata.
- Anonymous users cannot delete storage objects.
- Upload validation runs in both frontend and Edge Function code paths.
- File upload UI warns users that links are public.
- Share pages handle invalid, missing, expired, and deleted records gracefully.
- Admin delete attempts remove associated storage objects or report partial failure.
- Production setup documentation explains SQL policies, functions, secrets, and release checks.
- `corepack pnpm build` succeeds.
- Available unit tests pass.

## Open implementation decisions resolved in this spec

- Backend boundary: Supabase Edge Functions.
- Admin authorization: shared admin secret stored only in Supabase Function secrets.
- File sharing model: keep individual file uploads and client-side zip generation on download-all.
- Share URL style for this phase: keep current query-parameter share links to reduce routing risk.
