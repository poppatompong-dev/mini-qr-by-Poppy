-- Migration: Harden qr_files_log + storage security model
-- Project: MiniQR by Poppy
--
-- Goals (Priority 1):
--   * Add lifecycle columns (status / expires_at / updated_at / storage_prefix)
--   * Enable RLS so anonymous users can only READ shares that are `ready`
--     and not yet expired.
--   * Forbid anonymous INSERT / UPDATE / DELETE on metadata.
--   * All writes happen through Edge Functions using the service role,
--     which bypasses RLS.
--   * Add an append-only admin audit log.
--
-- This migration is idempotent and safe to run multiple times.

-- ---------------------------------------------------------------------------
-- 1. Base table (created here if it does not already exist)
-- ---------------------------------------------------------------------------
create table if not exists public.qr_files_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  file_name text not null default 'archive.zip',
  file_url text,
  file_size bigint not null default 0,
  files_list jsonb not null default '[]'::jsonb
);

-- ---------------------------------------------------------------------------
-- 2. Lifecycle columns
-- ---------------------------------------------------------------------------
alter table public.qr_files_log
  add column if not exists status text not null default 'pending',
  add column if not exists expires_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists storage_prefix text;

-- Enforce the allowed status set (drop first so re-runs can update the rule).
alter table public.qr_files_log
  drop constraint if exists qr_files_log_status_check;
alter table public.qr_files_log
  add constraint qr_files_log_status_check
  check (status in ('pending', 'ready', 'expired', 'deleted', 'failed'));

-- Backfill legacy rows: anything already created is treated as a ready share.
update public.qr_files_log
  set status = 'ready'
  where status is null or status = '';

-- Legacy rows stored their files directly under the share id folder.
update public.qr_files_log
  set storage_prefix = id::text
  where storage_prefix is null;

create index if not exists qr_files_log_status_expires_idx
  on public.qr_files_log (status, expires_at);

-- ---------------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.qr_files_log enable row level security;

-- Remove any permissive legacy policies before recreating the hardened ones.
drop policy if exists "Public can read logs" on public.qr_files_log;
drop policy if exists "Public can insert logs" on public.qr_files_log;
drop policy if exists "Public can update logs" on public.qr_files_log;
drop policy if exists "Public can delete logs" on public.qr_files_log;
drop policy if exists "public_read_ready_shares" on public.qr_files_log;
drop policy if exists "anon_no_write" on public.qr_files_log;

-- Anonymous + authenticated end users may ONLY read shares that are ready
-- and have not expired. No INSERT / UPDATE / DELETE policies exist for these
-- roles, so those operations are denied by default once RLS is enabled.
create policy "public_read_ready_shares"
  on public.qr_files_log
  for select
  to anon, authenticated
  using (
    status = 'ready'
    and (expires_at is null or expires_at > now())
  );

-- NOTE: The service_role used by Edge Functions bypasses RLS entirely, so it
-- can create pending records, finalize them, expire and delete them.

-- ---------------------------------------------------------------------------
-- 4. Admin audit log (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.qr_admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  action text not null,
  share_id uuid,
  detail jsonb not null default '{}'::jsonb
);

alter table public.qr_admin_audit_log enable row level security;
-- No policies => only the service role (Edge Functions) can read/write it.

-- ---------------------------------------------------------------------------
-- 5. Storage bucket policies (bucket: qr-files)
-- ---------------------------------------------------------------------------
-- Ensure the bucket exists and is public-read only.
insert into storage.buckets (id, name, public)
  values ('qr-files', 'qr-files', true)
  on conflict (id) do update set public = true;

-- Drop legacy permissive object policies if present.
drop policy if exists "qr-files public read" on storage.objects;
drop policy if exists "qr-files public insert" on storage.objects;
drop policy if exists "qr-files public update" on storage.objects;
drop policy if exists "qr-files public delete" on storage.objects;
drop policy if exists "Public Access" on storage.objects;

-- Public download (read) is allowed for objects in the qr-files bucket.
create policy "qr-files public read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'qr-files');

-- No INSERT / UPDATE / DELETE policies for anon/authenticated => denied.
-- Uploads are performed exclusively via signed upload URLs minted by the
-- share-session Edge Function (service role), and deletes happen via the
-- admin-shares / cleanup-expired-shares Edge Functions.
