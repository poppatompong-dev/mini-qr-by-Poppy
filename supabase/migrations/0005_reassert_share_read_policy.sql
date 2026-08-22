-- ---------------------------------------------------------------------------
-- Re-assert the read policy on qr_files_log.
--
-- 0001 enabled RLS and created `public_read_ready_shares`, but it only dropped
-- legacy policies by a fixed list of names. Any other permissive policy left on
-- the table — for instance one added later from the dashboard — keeps working
-- alongside it, and because RLS policies are OR-ed together a single permissive
-- SELECT policy re-opens the whole table.
--
-- Observed on the live project after 0001–0003 had been applied: an anonymous
-- REST query returned `pending` and already-expired rows, exposing the filename
-- list of every share ever created. This migration removes whatever is on the
-- table and puts back exactly one read policy.
--
-- Safe for the app: the only anonymous read it performs is the share page,
-- which loads a `ready`, unexpired share by id. Uploads, admin actions and
-- cleanup all run through Edge Functions on the service role, which bypasses
-- RLS entirely.
-- ---------------------------------------------------------------------------

do $$
declare
  policy_name text;
begin
  for policy_name in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'qr_files_log'
  loop
    execute format('drop policy %I on public.qr_files_log', policy_name);
  end loop;
end
$$;

alter table public.qr_files_log enable row level security;

-- Anonymous and authenticated end users may ONLY read shares that are ready and
-- have not expired. No INSERT / UPDATE / DELETE policy exists for those roles,
-- so those operations stay denied by default.
create policy "public_read_ready_shares"
  on public.qr_files_log
  for select
  to anon, authenticated
  using (
    status = 'ready'
    and (expires_at is null or expires_at > now())
  );

-- The audit log has no policies at all, so only the service role can touch it.
alter table public.qr_admin_audit_log enable row level security;
