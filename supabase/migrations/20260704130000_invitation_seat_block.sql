-- Attach-time seat enforcement (ADR-0016 D1): invitations never reserve
-- seats, so an accept can bounce at activation ("org is full"). The bounce is
-- an explicit contract: the pending invitation is visibly marked for the
-- inviting admin. First bounce wins — the adapter only writes when null.
alter table public.invitations
  add column if not exists seat_blocked_at timestamptz;
