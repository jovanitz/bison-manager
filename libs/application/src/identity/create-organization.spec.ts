import { describe, expect, it } from 'vitest';
import { fixedClock, sequentialIdGenerator } from '@acme/shared';
import { accessPresetPermissions } from '@acme/domain';
import type { NewIdentityMembership } from './ports';
import { makeCreateOrganization } from './create-organization';

const NOW = '2026-06-15T12:00:00.000Z';

const makeWorld = () => {
  const created: NewIdentityMembership[] = [];
  const seeded: string[] = [];
  const createOrganization = makeCreateOrganization({
    onboarding: {
      createCustomerMembership: async (m) => {
        created.push(m);
      },
    },
    installDefaults: async (accountId) => {
      seeded.push(accountId);
    },
    clock: fixedClock(new Date(NOW)),
    ids: sequentialIdGenerator('id'),
  });
  return { createOrganization, created, seeded };
};

describe('makeCreateOrganization', () => {
  it('creates an org with the customer-admin preset and returns its ids', async () => {
    const world = makeWorld();
    const r = await world.createOrganization({
      userId: 'user-1',
      email: 'me@acme.test',
      name: '  Casa Pampa  ',
    });
    expect(r.ok).toBe(true);
    expect(world.created).toHaveLength(1);
    expect(world.created[0]?.displayName).toBe('Casa Pampa');
    expect(world.created[0]?.permissions).toEqual(
      accessPresetPermissions('customer-admin'),
    );
    if (r.ok) {
      expect(r.value.accountId).toBe(world.created[0]?.accountId);
      expect(r.value.membershipId).toBe(world.created[0]?.membershipId);
      // ADR-0012: the new org's default roles are seeded on creation
      expect(world.seeded).toEqual([r.value.accountId]);
    }
  });

  it('rejects a blank name without touching the store', async () => {
    const world = makeWorld();
    const r = await world.createOrganization({
      userId: 'user-1',
      email: null,
      name: '   ',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/invalid-org-name');
    expect(world.created).toHaveLength(0);
  });
});
