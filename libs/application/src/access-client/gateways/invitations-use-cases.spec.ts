import { describe, expect, it } from 'vitest';
import { err, ok } from '@acme/shared';
import { invitationTokenInvalid } from '../../access-invitations/errors';
import { accessDenied } from '../../access/errors';
import { makeInvitationsUseCases } from './invitations-use-cases';
import type { ActivationGateway, InvitationsGateway } from '../ports';

const fakeInvitations = (
  overrides: Partial<InvitationsGateway> = {},
): InvitationsGateway => ({
  invite: async () => ok({ invitationId: 'inv-1', token: 'plain-token' }),
  ...overrides,
});

const fakeActivation = (
  overrides: Partial<ActivationGateway> = {},
): ActivationGateway => ({
  activate: async () => ok({ email: 'new@acme.test' }),
  ...overrides,
});

describe('makeInvitationsUseCases', () => {
  it('forwards invite (with the one-time token) and activate', async () => {
    const useCases = makeInvitationsUseCases({
      invitations: fakeInvitations(),
      activation: fakeActivation(),
    });

    const invited = await useCases.invite({
      accountId: 'acct-1',
      email: 'new@acme.test',
      permissions: [{ action: 'staff.read', scope: 'any' }],
    });
    expect(invited.ok && invited.value.token).toBe('plain-token');

    const activated = await useCases.activate({
      token: 'plain-token',
      password: 'sup3r-secret',
    });
    expect(activated.ok && activated.value.email).toBe('new@acme.test');
  });

  it('propagates gateway failures unchanged', async () => {
    const useCases = makeInvitationsUseCases({
      invitations: fakeInvitations({
        invite: async () => err(accessDenied('nope')),
      }),
      activation: fakeActivation({
        activate: async () => err(invitationTokenInvalid('bad token')),
      }),
    });

    const invited = await useCases.invite({
      accountId: 'acct-1',
      email: 'x@acme.test',
      permissions: [],
    });
    expect(invited.ok).toBe(false);
    if (!invited.ok) expect(invited.error.tag).toBe('app/access-denied');

    const activated = await useCases.activate({
      token: 'bad',
      password: 'sup3r-secret',
    });
    expect(activated.ok).toBe(false);
    if (!activated.ok)
      expect(activated.error.tag).toBe('app/invitation-token-invalid');
  });
});
