# Context: MiniQR Domain Glossary

This document defines the core business and domain concepts used in the MiniQR project.

## Glossary

### Multi-File QR Code (QR แนบไฟล์หลายไฟล์)
A QR code that encodes a share URL (carrying a `shareId`) for a set of files uploaded to Supabase Storage. Recipients open the share page to preview or download files individually, or download them all bundled into a `.zip` on demand.

### Share (ชุดแชร์ไฟล์)
A logical group of uploaded files tracked by one `qr_files_log` row, identified by a UUID `shareId`. A share has a `status` (`pending` → `ready`/`failed`), an `expires_at` timestamp, and a `storage_prefix` under which its objects are stored. Only `ready`, non-expired shares are publicly readable.

### Share Session (เซสชันการอัปโหลด)
The server-issued, short-lived upload context created by the `share-session` Edge Function. It creates the `pending` record and returns signed upload URLs so the browser can upload directly to Storage without any privileged key. `share-finalize` then verifies the uploads and flips the share to `ready`.

### Zip-on-Download (การบีบอัดตอนดาวน์โหลด)
Files are uploaded individually (not pre-zipped). The share page bundles them into a single `.zip` client-side only when the user chooses "download all".

### Supabase Storage (ระบบเก็บไฟล์คลาวด์)
The cloud storage service hosting uploaded files in the `qr-files` bucket. The bucket is public-read-only; writes and deletes are performed exclusively by Edge Functions using the service-role key. Objects live under each share's `storage_prefix`.

### Admin Secret (รหัสผู้ดูแลระบบ)
A server-only secret (`ADMIN_SECRET` Edge Function secret) required to call privileged `admin-shares` actions (`list`/`delete`/`expire`). It is never bundled into the browser; the admin panel sends it as the `x-admin-secret` header and it is held only in memory for the session.

### Share Expiry & Cleanup (การหมดอายุและการล้างข้อมูล)
Every share auto-expires after `SHARE_EXPIRY_DAYS`. The scheduled `cleanup-expired-shares` Edge Function permanently removes expired shares and reaps orphaned `pending`/`failed` uploads.

### Sponsor Modal (หน้าต่างสนับสนุน)
An interactive pop-up dialog that displays a dynamically calculated PromptPay QR code to receive support donations, hardcoded with the computer technical officer's information.
