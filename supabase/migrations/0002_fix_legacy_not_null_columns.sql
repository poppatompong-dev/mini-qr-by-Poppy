-- Migration: Fix legacy NOT NULL columns that break share-session inserts
-- Project: MiniQR by Poppy
--
-- The original dev-era table (docs/supabase_setup.sql) declared
--   file_name TEXT NOT NULL      (no default)
--   file_url  TEXT NOT NULL      (no default)
-- Migration 0001 used CREATE TABLE IF NOT EXISTS, which is a no-op on that
-- existing table, so the production schema kept those constraints.
--
-- The hardened flow inserts a `pending` row WITHOUT file_name/file_url
-- (share-finalize fills them in after uploads are verified), so every
-- share-session insert failed with a NOT NULL violation ("DB_ERROR").
--
-- This migration is idempotent and safe to run multiple times.

alter table public.qr_files_log
  alter column file_name set default 'archive.zip';

alter table public.qr_files_log
  alter column file_url drop not null;
