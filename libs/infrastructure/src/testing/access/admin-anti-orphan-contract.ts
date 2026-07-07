import { describe, expect, it } from 'vitest';
import { accessPresetPermissions } from '@acme/domain';
import type {
  AccessPermission,
  AccountId,
  MembershipId,
  Role,
  RoleId,
  UserId,
} from '@acme/domain';
import type { InMemoryAccessSeed } from '../../access/in-memory-access-seed';
import {
  ACCESS_CONTRACT_NOW as NOW,
  accessContractSeed,
  makeAccessContractIds,
} from './access-store-fixtures';
import type { AccessStorePorts } from './access-store-fixtures';

/** A platform role whose only permission is the governing capability. */
const governingRole = (): Role => ({
  id: crypto.randomUUID() as RoleId,
  name: 'Governor' as Role['name'],
  accountId: null,
  templateKey: null,
  templateSynced: true,
  isPersonal: false,
  permissions: [
    { action: 'permissions.update', scope: 'any' },
  ] as Role['permissions'],
});

type NewMember = {
  readonly accountId: AccountId;
  readonly membershipId: MembershipId;
  readonly userId: UserId;
  readonly permissions?: ReadonlyArray<AccessPermission>;
  readonly roleIds?: ReadonlyArray<RoleId>;
};

/** Bootstrap an owner (root) of a fresh account with the given grant. */
const addOwner = (store: AccessStorePorts, m: NewMember) =>
  store.onboarding.createOwnerMembership(
    {
      membershipId: m.membershipId,
      accountId: m.accountId,
      userId: m.userId,
      email: `${m.membershipId}@example.com`,
      displayName: 'Owner',
      permissions: m.permissions ?? [],
      occurredAt: NOW,
    },
    {
      type: 'owner.bootstrapped',
      membershipId: m.membershipId,
      userId: m.userId,
      occurredAt: NOW,
    },
  );

/** Join an existing account via an accepted invitation (perms and/or roles). */
const accept = (store: AccessStorePorts, m: NewMember) =>
  store.onboarding.acceptInvitation(
    {
      membershipId: m.membershipId,
      accountId: m.accountId,
      userId: m.userId,
      email: `${m.membershipId}@example.com`,
      displayName: 'Member',
      permissions: m.permissions ?? [],
      roleIds: m.roleIds ?? [],
      occurredAt: NOW,
    },
    { invitationId: crypto.randomUUID() as never, seatLimit: null },
    {
      type: 'invitation.accepted',
      invitationId: crypto.randomUUID() as never,
      accountId: m.accountId,
      membershipId: m.membershipId,
      userId: m.userId,
      occurredAt: NOW,
    },
  );

/**
 * Anti-orphan invariant of the admin repository (ADR-0011/0014): an account
 * never loses its last administrator, verified atomically (locked count) so two
 * concurrent demotions cannot both pass. Admin capability is read from EFFECTIVE
 * permissions — role expansion — so a role-granted admin counts, and role
 * reassignment is guarded like a demotion. Split out to keep each file small.
 */
export const adminAntiOrphanContract = (
  name: string,
  makeStore: (
    seed: InMemoryAccessSeed,
  ) => AccessStorePorts | Promise<AccessStorePorts>,
): void => {
  describe(`AdminRepository anti-orphan contract: ${name}`, () => {
    it('refuses to demote the last administrator (anti-orphan), atomically', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      const accountId = crypto.randomUUID() as AccountId;
      const adminId = crypto.randomUUID() as MembershipId;
      await addOwner(store, {
        accountId,
        membershipId: adminId,
        userId: ids.userNew,
        permissions: accessPresetPermissions('owner'),
      });

      const event = {
        type: 'permissions.updated' as const,
        membershipId: adminId,
        actorMembershipId: ids.membershipSupport,
        before: accessPresetPermissions('owner'),
        after: accessPresetPermissions('customer'),
        occurredAt: NOW,
      };
      // demoting the only admin is refused; nothing is written
      const blocked = await store.admin.updatePermissions(
        adminId,
        accessPresetPermissions('customer'),
        event,
        true,
      );
      expect(blocked.orphaned).toBe(true);
      expect((await store.admin.findMembership(adminId))?.permissions).toEqual(
        accessPresetPermissions('owner'),
      );

      // a second admin makes the demotion safe
      await accept(store, {
        accountId,
        membershipId: crypto.randomUUID() as MembershipId,
        userId: ids.userSupport,
        permissions: accessPresetPermissions('owner'),
      });
      const applied = await store.admin.updatePermissions(
        adminId,
        accessPresetPermissions('customer'),
        event,
        true,
      );
      expect(applied.orphaned).toBe(false);
      expect((await store.admin.findMembership(adminId))?.permissions).toEqual(
        accessPresetPermissions('customer'),
      );
    });

    it('counts a role-granted administrator toward anti-orphan (effective perms)', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      const accountId = crypto.randomUUID() as AccountId;
      const directAdmin = crypto.randomUUID() as MembershipId;
      await addOwner(store, {
        accountId,
        membershipId: directAdmin,
        userId: ids.userNew,
        permissions: accessPresetPermissions('owner'),
      });
      // a co-member whose admin capability comes ONLY from an assigned role
      const role = governingRole();
      await store.roles.create(role);
      await accept(store, {
        accountId,
        membershipId: crypto.randomUUID() as MembershipId,
        userId: ids.userSupport,
        roleIds: [role.id],
      });

      // the role-admin governs, so demoting the direct admin is NOT an orphan
      const applied = await store.admin.updatePermissions(
        directAdmin,
        accessPresetPermissions('customer'),
        {
          type: 'permissions.updated',
          membershipId: directAdmin,
          actorMembershipId: ids.membershipSupport,
          before: accessPresetPermissions('owner'),
          after: accessPresetPermissions('customer'),
          occurredAt: NOW,
        },
        true,
      );
      expect(applied.orphaned).toBe(false);
    });

    it('refuses to strip the account’s last administrator via role reassignment', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      // a seeded, member-less account (so the role-admin below is its only one)
      const accountId = ids.acctCustomer;
      const adminRole = governingRole();
      const plainRole: Role = {
        id: crypto.randomUUID() as RoleId,
        name: 'Member' as Role['name'],
        accountId: null,
        templateKey: null,
        templateSynced: true,
        isPersonal: false,
        permissions: [
          { action: 'members.read', scope: 'own' },
        ] as Role['permissions'],
      };
      await store.roles.create(adminRole);
      await store.roles.create(plainRole);
      // sole member, an admin ONLY through the assigned governing role
      const soleAdmin = crypto.randomUUID() as MembershipId;
      await accept(store, {
        accountId,
        membershipId: soleAdmin,
        userId: ids.userNew,
        roleIds: [adminRole.id],
      });
      const event = {
        type: 'member.roles-assigned' as const,
        membershipId: soleAdmin,
        actorMembershipId: soleAdmin,
        roleIds: [plainRole.id],
        occurredAt: NOW,
      };
      // swapping the sole admin to a non-admin role would orphan → refused
      expect(
        (await store.admin.assignRoles(soleAdmin, [plainRole.id], event))
          .orphaned,
      ).toBe(true);

      // a co-admin makes the same reassignment safe
      await accept(store, {
        accountId,
        membershipId: crypto.randomUUID() as MembershipId,
        userId: ids.userSupport,
        roleIds: [adminRole.id],
      });
      expect(
        (await store.admin.assignRoles(soleAdmin, [plainRole.id], event))
          .orphaned,
      ).toBe(false);
    });
  });
};
