-- Staged org deletion (billing-lifecycle policy, 2026-07-08). Staff mark an org
-- for deletion; it stays fully recoverable until `pending_deletion_until`, then a
-- separate purge removes operational data/PII while the financial ledger is
-- retained (MX fiscal law). NULL = not scheduled.
alter table public.accounts
  add column if not exists pending_deletion_until timestamptz;
