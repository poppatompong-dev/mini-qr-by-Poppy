-- ---------------------------------------------------------------------------
-- Per-share switch for the "download everything as one ZIP" button.
--
-- Recipients on phones frequently cannot open a .zip, so the share creator can
-- now turn the bulk button off and force one-file-at-a-time downloads.
-- Existing shares (and any client that does not send the flag) keep the old
-- behaviour, hence the `true` default.
-- ---------------------------------------------------------------------------
alter table public.qr_files_log
  add column if not exists allow_bulk_download boolean not null default true;
