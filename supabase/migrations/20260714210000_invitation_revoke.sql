-- Revoking an invitation (ADR-0011 access model): staff withdraw a PENDING
-- invitation before it is accepted. It is a distinct fact from expiry (time
-- driven) and from acceptance — so it gets its own column, not an expiry poke.
--
-- A revoked invitation must also stop ACTIVATING, so the use case burns the
-- token hash in the same transaction; the column is what keeps it out of the
-- pending list even if a token were somehow replayed.
alter table public.invitations
  add column if not exists revoked_at timestamptz;

-- The pending-by-email uniqueness/index must ignore revoked rows too, so a
-- fresh invitation can be issued to an email whose previous one was revoked.
drop index if exists invitations_pending_email_idx;
create index if not exists invitations_pending_email_idx
  on public.invitations (lower(email))
  where accepted_at is null and revoked_at is null;
