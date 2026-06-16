import { describe, expect, it } from 'vitest';
import { sign } from 'hono/jwt';
import { createApiRuntime } from '../composition-root';
import { callRpc } from '../testing/rpc-harness';

/**
 * End-to-end multi-organization flow ("the doctor"): one login, several
 * organizations, permissions depending on where they stand. Real JWT
 * pipeline against the in-memory store.
 */
const SECRET = 'test-secret-at-least-32-characters-long!';
const OWNER_EMAIL = 'owner@example.com';
const DOCTOR_EMAIL = 'doctor@example.com';

const runtime = () =>
  createApiRuntime({
    seed: {},
    jwtSecret: SECRET,
    bootstrapOwnerEmail: OWNER_EMAIL,
  });

const tokenFor = (input: {
  userId: string;
  sessionId: string;
  email: string;
}) =>
  sign(
    {
      sub: input.userId,
      session_id: input.sessionId,
      email: input.email,
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    SECRET,
  );

const currentOf = async (res: Response) =>
  ((await res.json()) as { data: { accountId: string; membershipId: string } })
    .data;

describe('multi-organization: one login, several organizations', () => {
  it('invitation joins a SECOND org; the switcher moves the session between them', async () => {
    const { app } = runtime();
    const owner = await tokenFor({
      userId: crypto.randomUUID(),
      sessionId: crypto.randomUUID(),
      email: OWNER_EMAIL,
    });
    const ownerAccess = await currentOf(
      await callRpc(app, 'access.current', { token: owner }),
    );

    // the doctor self-signs-up (org-less) and creates their OWN organization
    const doctorUserId = crypto.randomUUID();
    const firstLogin = await tokenFor({
      userId: doctorUserId,
      sessionId: crypto.randomUUID(),
      email: DOCTOR_EMAIL,
    });
    const createdHome = await app.request('/id/create-organization', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${firstLogin}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Doctor Clinic' }),
    });
    expect(createdHome.status).toBe(200);
    const homeOrg = await currentOf(
      await callRpc(app, 'access.current', { token: firstLogin }),
    );

    // the owner invites the SAME email into the owner's organization
    const invited = await callRpc(app, 'members.invite', {
      token: owner,
      body: {
        accountId: ownerAccess.accountId,
        email: DOCTOR_EMAIL,
        permissions: [{ action: 'audit.read', scope: 'any' }],
      },
    });
    expect(invited.status).toBe(200);

    // next login (fresh session): the invitation wins, no third account
    const secondLogin = await tokenFor({
      userId: doctorUserId,
      sessionId: crypto.randomUUID(),
      email: DOCTOR_EMAIL,
    });
    const invitedSide = await currentOf(
      await callRpc(app, 'access.current', { token: secondLogin }),
    );
    expect(invitedSide.accountId).toBe(ownerAccess.accountId);

    // the switcher sees both organizations
    const mineRes = await callRpc(app, 'memberships.mine', {
      token: secondLogin,
    });
    expect(mineRes.status).toBe(200);
    const mine = (await mineRes.json()) as {
      data: ReadonlyArray<{ membershipId: string; accountId: string }>;
    };
    expect(mine.data.map((m) => m.accountId).sort()).toEqual(
      [homeOrg.accountId, ownerAccess.accountId].sort(),
    );

    // switch the live session back to the home organization
    const home = mine.data.find((m) => m.accountId === homeOrg.accountId);
    const switched = await callRpc(app, 'session.switch-account', {
      token: secondLogin,
      body: { membershipId: home?.membershipId },
    });
    expect(switched.status).toBe(200);
    const after = await currentOf(
      await callRpc(app, 'access.current', { token: secondLogin }),
    );
    expect(after.accountId).toBe(homeOrg.accountId);

    // someone else's membership is unreachable (404, structural guard)
    const foreign = await callRpc(app, 'session.switch-account', {
      token: secondLogin,
      body: { membershipId: ownerAccess.membershipId },
    });
    expect(foreign.status).toBe(404);

    // the whole journey is on the audit trail
    const audit = await callRpc(app, 'audit.list', { token: owner, body: {} });
    const events = (await audit.json()) as {
      data: ReadonlyArray<{ event: { type: string } }>;
    };
    for (const expected of [
      'invitation.created',
      'invitation.accepted',
      'session.switched',
    ]) {
      expect(events.data.map((r) => r.event.type)).toContain(expected);
    }
  });
});
