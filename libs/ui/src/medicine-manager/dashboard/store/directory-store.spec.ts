import { describe, expect, it, vi } from 'vitest';
import { ok } from '@acme/shared';
import {
  createDirectoryStore,
  type DirectoryStoreDeps,
} from './directory-store';

const snapshot = {
  membershipId: 'mem',
  userId: 'me@acme.test',
  accountId: 'acc-self',
  accountStatus: 'active',
  blocked: false,
  session: { id: 's', status: 'active', expiresAt: '2099-01-01T00:00:00Z' },
  permissions: [{ action: 'access.block', scope: 'any' }],
  activeGrants: [],
};

const coverage = {
  phase: 'suspended' as const,
  dormant: false,
  balanceMinor: 5684,
  currency: 'MXN',
  paidThroughAt: null,
};

const makeDeps = (over: Record<string, unknown> = {}) =>
  ({
    access: { currentAccess: async () => ok(snapshot) },
    directory: {
      listStaff: async () =>
        ok([
          { accountId: 'acc-self', email: 'me@x.mx', displayName: 'Me' },
          { accountId: 'acc-2', email: 'b@x.mx', displayName: 'Bee' },
        ]),
      listCustomers: async () =>
        ok([{ accountId: 'org-1', displayName: 'Clínica', email: 'c@x.mx' }]),
      listOrphans: async () => ok([]),
      purgeOrphan: async () => ok(undefined),
    },
    invitations: {
      listPending: async () => ok([]),
      invite: async () => ok({ invitationId: 'i', token: 'tok' }),
      regenerate: async () => ok({ token: 'rot' }),
      revoke: async () => ok(undefined),
      resend: async () => ok(undefined),
    },
    billing: { coverageFor: async () => coverage },
    block: {
      blockOrg: async () => ok(undefined),
      unblockOrg: async () => ok(undefined),
      blockIdentity: async () => ok(undefined),
      unblockIdentity: async () => ok(undefined),
    },
    accounts: {
      disable: async () => ok(undefined),
      enable: async () => ok(undefined),
      promote: async () => ok(undefined),
      demote: async () => ok(undefined),
    },
    ...over,
  }) as unknown as DirectoryStoreDeps;

describe('createDirectoryStore', () => {
  it('load maps the flow read model into the VM', async () => {
    const store = createDirectoryStore(makeDeps());
    await store.getState().load();
    const vm = store.getState().vm;
    expect(vm?.canBlock).toBe(true);
    expect(vm?.customers.find((c) => c.accountId === 'org-1')?.phase).toBe(
      'suspended',
    );
    expect(vm?.staff.find((s) => s.accountId === 'acc-self')?.isSelf).toBe(
      true,
    );
  });

  it('block dispatches the command and reloads', async () => {
    const blockOrg = vi.fn(async () => ok(undefined));
    const store = createDirectoryStore(
      makeDeps({
        block: {
          blockOrg,
          unblockOrg: async () => ok(undefined),
          blockIdentity: async () => ok(undefined),
          unblockIdentity: async () => ok(undefined),
        },
      }),
    );
    await store.getState().block('org', 'org-1', true);
    expect(blockOrg).toHaveBeenCalledWith('org-1');
    expect(store.getState().vm).not.toBeNull();
  });

  it('invite returns the fresh activation token, discriminated from failure', async () => {
    const store = createDirectoryStore(makeDeps());
    const result = await store.getState().invite('new@x.mx');
    // Discriminated on purpose: a bare string could not tell a token from an
    // error message, and the caller would put the error on the clipboard.
    expect(result).toEqual({ ok: true, token: 'tok' });
  });

  it('revoke withdraws the invitation and reloads the list', async () => {
    const revoke = vi.fn(async () => ok(undefined));
    const store = createDirectoryStore(
      makeDeps({
        invitations: {
          listPending: async () => ok([]),
          invite: async () => ok({ invitationId: 'i', token: 'tok' }),
          regenerate: async () => ok({ token: 'rot' }),
          revoke,
          resend: async () => ok(undefined),
        },
      }),
    );
    await store.getState().revoke('inv-1');
    expect(revoke).toHaveBeenCalledWith('inv-1');
    // Reloaded: the withdrawn row must leave the list without a manual refresh.
    expect(store.getState().vm).not.toBeNull();
  });
});
