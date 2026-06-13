import { describe, expect, it } from 'vitest';
import {
  ACCESS_SESSION_POLICY_DEFAULTS,
  accessPresetPermissions,
} from '@acme/domain';
import type { MembershipId, SessionId } from '@acme/domain';
import type { InMemoryAccessSeed } from '../../access/in-memory-access-seed';
import {
  ACCESS_CONTRACT_NOW as NOW,
  makeAccessContractIds,
} from './access-store-fixtures';
import type { AccessStorePorts } from './access-store-fixtures';

const HOUR = 3_600_000;
const MIN = 60_000;
const LOGIN = '2026-06-09T11:00:00.000Z'; // 1 h before NOW
const FAR = '2026-06-09T18:00:00.000Z';

const tighter = {
  customer: { idleTtlMs: 12 * HOUR, maxLifetimeMs: 48 * HOUR },
  staff: { idleTtlMs: 15 * MIN, maxLifetimeMs: 8 * HOUR },
};

const settingsEvent = (actorMembershipId: MembershipId) => ({
  type: 'settings.updated' as const,
  actorMembershipId,
  before: ACCESS_SESSION_POLICY_DEFAULTS,
  after: tighter,
  occurredAt: NOW,
});

/**
 * Contract for the session-policy ports: load/save with the atomic shrink of
 * live sessions, and the activity recorder that materializes slides. Runs
 * against both stores like every other access contract.
 */
export const sessionPolicyContract = (
  name: string,
  makeStore: (
    seed: InMemoryAccessSeed,
  ) => AccessStorePorts | Promise<AccessStorePorts>,
): void => {
  describe(`SessionPolicy contract: ${name}`, () => {
    const world = () => {
      const ids = makeAccessContractIds();
      const membershipCustomer = crypto.randomUUID() as MembershipId;
      const sessionCustomer = crypto.randomUUID() as SessionId;
      const userCustomer = crypto.randomUUID();
      const seed: InMemoryAccessSeed = {
        accounts: [{ id: ids.acctSupport }, { id: ids.acctCustomer }],
        customers: [
          {
            accountId: ids.acctCustomer,
            displayName: 'Casa Pampa',
            email: 'ops@casapampa.example',
          },
        ],
        memberships: [
          {
            id: ids.membershipSupport,
            userId: ids.userSupport,
            accountId: ids.acctSupport,
            permissions: accessPresetPermissions('support'),
          },
          {
            id: membershipCustomer,
            userId: userCustomer,
            accountId: ids.acctCustomer,
            permissions: accessPresetPermissions('customer'),
          },
        ],
        sessions: [
          {
            id: ids.sessionSupport,
            membershipId: ids.membershipSupport,
            expiresAt: FAR,
            createdAt: LOGIN,
          },
          {
            id: sessionCustomer,
            membershipId: membershipCustomer,
            expiresAt: FAR,
            createdAt: LOGIN,
          },
        ],
      };
      return { ids, seed, sessionCustomer };
    };

    it('loads the domain defaults until a policy is saved', async () => {
      const { ids, seed } = world();
      const store = await makeStore(seed);
      expect(await store.sessionPolicies.loadSessionPolicies()).toEqual(
        ACCESS_SESSION_POLICY_DEFAULTS,
      );
      const saved = await store.sessionPolicies.saveSessionPolicies(
        tighter,
        settingsEvent(ids.membershipSupport),
        1,
      );
      expect(saved).toBe(true);
      expect(await store.sessionPolicies.loadSessionPolicies()).toEqual(
        tighter,
      );
      const settings = await store.sessionPolicies.loadSessionSettings();
      expect(settings.version).toBe(2);
      // optimistic locking: a stale version writes nothing
      expect(
        await store.sessionPolicies.saveSessionPolicies(
          tighter,
          settingsEvent(ids.membershipSupport),
          1,
        ),
      ).toBe(false);
      expect(
        (await store.auditTrail.list()).map((r) => r.event.type),
      ).toContain('settings.updated');
    });

    it('records activity on live sessions only', async () => {
      const { ids, seed } = world();
      const store = await makeStore(seed);
      const slidTo = '2026-06-09T18:30:00.000Z';
      await store.sessionActivity.recordSessionActivity({
        sessionId: ids.sessionSupport,
        lastSeenAt: NOW,
        expiresAt: slidTo,
        ipAddress: '203.0.113.9',
      });
      const actor = await store.actors.findActorBySession(ids.sessionSupport);
      expect(actor?.session.expiresAt).toBe(slidTo);
    });

    it('never slides a revoked or already-expired session', async () => {
      const { ids, seed } = world();
      const expiredSession = crypto.randomUUID() as SessionId;
      const store = await makeStore({
        ...seed,
        sessions: [
          ...(seed.sessions ?? []).map((s) =>
            s.id === ids.sessionSupport
              ? { ...s, status: 'revoked' as const }
              : s,
          ),
          {
            id: expiredSession,
            membershipId: ids.membershipSupport,
            expiresAt: '2026-06-09T11:30:00.000Z', // already past NOW
            createdAt: LOGIN,
          },
        ],
      });
      const slideTarget = '2026-06-09T19:00:00.000Z';
      for (const sessionId of [ids.sessionSupport, expiredSession]) {
        await store.sessionActivity.recordSessionActivity({
          sessionId,
          lastSeenAt: NOW,
          expiresAt: slideTarget,
          ipAddress: null,
        });
        const actor = await store.actors.findActorBySession(sessionId);
        expect(actor?.session.expiresAt).not.toBe(slideTarget);
      }
    });

    it('revokeAllSessions logs a membership out everywhere, audited per session', async () => {
      const { ids, seed } = world();
      const store = await makeStore(seed);
      const revoked = await store.admin.revokeAllSessions(
        ids.membershipSupport,
        { actorMembershipId: ids.membershipSupport, occurredAt: NOW },
      );
      expect(revoked).toBe(1);
      const actor = await store.actors.findActorBySession(ids.sessionSupport);
      expect(actor?.session.status).toBe('revoked');
      expect(
        (await store.auditTrail.list()).map((r) => r.event.type),
      ).toEqual(['session.revoked']);
      // idempotent: nothing left to revoke
      expect(
        await store.admin.revokeAllSessions(ids.membershipSupport, {
          actorMembershipId: ids.membershipSupport,
          occurredAt: NOW,
        }),
      ).toBe(0);
    });

    it('promoting an account to staff clamps its sessions and hides it from the directory', async () => {
      const { ids, seed, sessionCustomer } = world();
      const store = await makeStore(seed);
      await store.admin.promoteAccountToStaff(
        ids.acctCustomer,
        {
          type: 'account.promoted',
          accountId: ids.acctCustomer,
          actorMembershipId: ids.membershipSupport,
          occurredAt: NOW,
        },
        ACCESS_SESSION_POLICY_DEFAULTS.staff,
      );
      // out of the customer directory → never impersonable again
      expect(await store.customers.read(ids.acctCustomer)).toBeNull();
      // its session clamped to the strict staff policy:
      // last seen at LOGIN (11:00) + 30 min idle → 11:30 (was 18:00)
      const actor = await store.actors.findActorBySession(sessionCustomer);
      expect(actor?.session.expiresAt).toBe('2026-06-09T11:30:00.000Z');
      expect(actor?.accountKind).toBe('staff');
      expect(
        (await store.auditTrail.list()).map((r) => r.event.type),
      ).toEqual(['account.promoted']);
    });

    it('tightening shrinks live sessions per kind, atomically with the audit', async () => {
      const { ids, seed, sessionCustomer } = world();
      const store = await makeStore(seed);
      await store.sessionPolicies.saveSessionPolicies(
        tighter,
        settingsEvent(ids.membershipSupport),
        1,
      );
      // staff: last seen at LOGIN + 15 min idle → 11:15, capped from 18:00
      const staff = await store.actors.findActorBySession(ids.sessionSupport);
      expect(staff?.session.expiresAt).toBe('2026-06-09T11:15:00.000Z');
      // customer: 12 h idle from LOGIN → 23:00 > 18:00 → untouched
      const customer = await store.actors.findActorBySession(sessionCustomer);
      expect(customer?.session.expiresAt).toBe(FAR);
      expect(
        (await store.auditTrail.list()).map((r) => r.event.type),
      ).toContain('settings.updated');
    });
  });
};
