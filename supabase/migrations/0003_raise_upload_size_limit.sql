-- ---------------------------------------------------------------------------
-- Raise the per-object upload limit for the qr-files bucket to 50 MB.
--
-- The app enforces a 50 MB *total* size per share (MAX_UPLOAD_BYTES), but each
-- file is uploaded individually through a signed URL, so Storage only ever
-- sees single objects. Without an explicit bucket limit the object falls back
-- to the project-wide upload cap, which rejects larger files with
-- "Payload too large" long before the share total is reached.
-- ---------------------------------------------------------------------------
update storage.buckets
  set file_size_limit = 52428800  -- 50 MB
  where id = 'qr-files';
