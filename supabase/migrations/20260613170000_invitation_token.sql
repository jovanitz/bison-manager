-- One-time activation token for invitations.
--
-- Only the SHA-256 hash of the token is stored; the plaintext lives solely in
-- the activation link handed to the invitee. The column is nulled when the
-- token is consumed, so a link is single-use. A leaked database yields no
-- working links (the hash is one-way).
alter table public.invitations
  add column if not exists token_hash text;

create index if not exists invitations_token_hash_idx
  on public.invitations (token_hash)
  where token_hash is not null;
