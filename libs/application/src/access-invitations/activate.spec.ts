import { describe, expect, it } from 'vitest';
import { fixedClock } from '@acme/shared';
import { TEST_ACCESS_NOW } from '../access/testing';
import { makeActivateInvitation } from './activate';
import type { ActivateInvitationDeps } from './activate';
import type { IdentityProvisioner, PendingInvitationByToken } from './ports';

const TOKEN_INVITE: PendingInvitationByToken = {
  invitationId: 'inv-1' as PendingInvitationByToken['invitationId'],
  accountId: 'acct-1' as PendingInvitationByToken['accountId'],
  email: 'new@example.com',
};

const okProvisioner: IdentityProvisioner = {
  createIdentity: async () => ({ ok: true, value: { userId: 'user-new' } }),
};

const makeActivate = (input?: {
  byToken?: PendingInvitationByToken | null;
  provisioner?: IdentityProvisioner;
}) => {
  const deps: ActivateInvitationDeps = {
    invitations: { findPendingByTokenHash: async () => input?.byToken ?? null },
    provisioner: input?.provisioner ?? okProvisioner,
    tokens: { hashOf: (token) => `hash-of-${token}` },
    clock: fixedClock(new Date(TEST_ACCESS_NOW)),
  };
  return makeActivateInvitation(deps);
};

describe('activateInvitation', () => {
  it('creates the identity but leaves the invitation PENDING for first login', async () => {
    // Regression: activation must NOT consume the invitation — the membership +
    // consumption are attached atomically on first login. The deps here lack
    // `consumeToken` entirely, so consumption here is unrepresentable by design.
    const activate = makeActivate({ byToken: TOKEN_INVITE });
    const r = await activate({
      token: 'plain-token',
      password: 'sup3r-secret',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.email).toBe('new@example.com');
  });

  it('fails generically on an unknown/expired/used token (no enumeration)', async () => {
    const activate = makeActivate({ byToken: null });
    const r = await activate({ token: 'whatever', password: 'sup3r-secret' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/invitation-token-invalid');
  });

  it('refuses when the email already has an identity (no takeover)', async () => {
    const activate = makeActivate({
      byToken: TOKEN_INVITE,
      provisioner: {
        createIdentity: async () => ({
          ok: false,
          error: { tag: 'app/identity-already-exists', message: 'exists' },
        }),
      },
    });
    const r = await activate({
      token: 'plain-token',
      password: 'sup3r-secret',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/identity-already-exists');
  });
});
