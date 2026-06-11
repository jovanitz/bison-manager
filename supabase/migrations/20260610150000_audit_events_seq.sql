-- Stable, gap-tolerant ordering for the append-only audit trail. occurred_at
-- can collide (several events in one transaction share a timestamp), so the
-- trail orders by an identity ordinal instead.
alter table public.audit_events
  add column seq bigint generated always as identity;

create unique index audit_events_seq_idx on public.audit_events (seq);
