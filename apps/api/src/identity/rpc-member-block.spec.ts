import { describe, expect, it } from 'vitest';
import { sign } from 'hono/jwt';
import { createApiRuntime } from '../composition-root';
import { callRpc } from '../testing/rpc-harness';

/**
 * End-to-end per-membership soft block ("the org admin disciplines a member"):
 * a customer-admin blocks one member of their OWN org. The member keeps signing
 * in (access.current → 200, blocked: true) but every gated operation is denied
 * (403). Unblocking restores them. Real JWT pipeline against the in-memory store.
 */
const SECRET = 'test-secret-at-least-32-characters-long!';
const OWNER_EMAIL = 'owner@example.com';
const ADMIN_EMAIL = 'clinic-admin@example.com';
const MEMBER_EMAIL = 'nurse@example.com';

const runtime = () =>
  createApiRuntime({
    seed: {},
    jwtSecret: SECRET,
    bootstrapOwnerEmail: OWNER_EMAIL,
  });

const tokenFor = (input: { userId: string; email: string }) =>
  sign(
    {
      sub: input.userId,
      session_id: crypto.randomUUID(),
      email: input.email,
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    SECRET,
  );

const currentOf = async (res: Response) =>
  (
    (await res.json()) as {
      data: { accountId: string; membershipId: string; blocked: boolean };
    }
  ).data;

describe('per-membership soft block (members.block)', () => {
  it('blocks one member of the admin’s org: login stays, operations are denied', async () => {
    const { app } = runtime();

    // The clinic admin self-signs-up and creates their OWN org (customer-admin).
    const adminToken = await tokenFor({
      userId: crypto.randomUUID(),
      email: ADMIN_EMAIL,
    });
    const created = await app.request('/id/create-organization', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Clinic' }),
    });
    expect(created.status).toBe(200);
    const adminAccess = await currentOf(
      await callRpc(app, 'access.current', { token: adminToken }),
    );

    // The admin invites a nurse into the clinic with an own-scope read grant.
    const invited = await callRpc(app, 'members.invite', {
      token: adminToken,
      body: {
        accountId: adminAccess.accountId,
        email: MEMBER_EMAIL,
        permissions: [{ action: 'members.read', scope: 'own' }],
      },
    });
    expect(invited.status).toBe(200);

    // The nurse logs in (invitation accepted) and can operate in the clinic.
    const memberToken = await tokenFor({
      userId: crypto.randomUUID(),
      email: MEMBER_EMAIL,
    });
    const memberAccess = await currentOf(
      await callRpc(app, 'access.current', { token: memberToken }),
    );
    expect(memberAccess.accountId).toBe(adminAccess.accountId);
    expect(memberAccess.blocked).toBe(false);
    const before = await callRpc(app, 'members.list', {
      token: memberToken,
      body: { accountId: adminAccess.accountId },
    });
    expect(before.status).toBe(200);

    // The admin blocks the nurse's membership.
    const blocked = await callRpc(app, 'members.block', {
      token: adminToken,
      body: {
        membershipId: memberAccess.membershipId,
        reason: 'policy breach',
      },
    });
    expect(blocked.status).toBe(200);

    // Soft block: the nurse still authenticates, but operations are denied.
    const after = await currentOf(
      await callRpc(app, 'access.current', { token: memberToken }),
    );
    expect(after.blocked).toBe(true);
    const denied = await callRpc(app, 'members.list', {
      token: memberToken,
      body: { accountId: adminAccess.accountId },
    });
    expect(denied.status).toBe(403);

    // Unblock restores the nurse.
    const unblocked = await callRpc(app, 'members.unblock', {
      token: adminToken,
      body: { membershipId: memberAccess.membershipId },
    });
    expect(unblocked.status).toBe(200);
    const restored = await callRpc(app, 'members.list', {
      token: memberToken,
      body: { accountId: adminAccess.accountId },
    });
    expect(restored.status).toBe(200);
  });

  it('cannot block a member of ANOTHER org (own scope) and never the admin itself', async () => {
    const { app } = runtime();
    const owner = await tokenFor({
      userId: crypto.randomUUID(),
      email: OWNER_EMAIL,
    });
    const ownerAccess = await currentOf(
      await callRpc(app, 'access.current', { token: owner }),
    );

    const adminToken = await tokenFor({
      userId: crypto.randomUUID(),
      email: ADMIN_EMAIL,
    });
    await app.request('/id/create-organization', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Clinic' }),
    });
    const adminAccess = await currentOf(
      await callRpc(app, 'access.current', { token: adminToken }),
    );

    // The owner's membership lives in another org → own-scope block is refused.
    const foreign = await callRpc(app, 'members.block', {
      token: adminToken,
      body: { membershipId: ownerAccess.membershipId },
    });
    expect(foreign.status).toBe(403);

    // Blocking your own membership is refused (no self-lockout).
    const self = await callRpc(app, 'members.block', {
      token: adminToken,
      body: { membershipId: adminAccess.membershipId },
    });
    expect(self.status).toBe(403);
  });
});
