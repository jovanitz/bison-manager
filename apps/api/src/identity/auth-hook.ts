import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Context } from 'hono';
import type { AuditTrailUseCases } from '@acme/application';

/**
 * GoTrue `password_verification_attempt` hook receiver: the identity
 * provider tells us about every password check, and failed attempts land in
 * the audit trail (`login.failed`) — data you cannot reconstruct later.
 *
 * Authentication of the hook itself: standard-webhooks HMAC signature
 * (`webhook-id`.`webhook-timestamp`.`body`, secret `v1,whsec_<base64>`).
 * Without a configured secret the endpoint only trusts the call in dev.
 */
export type AuthHookDeps = {
  /** standard-webhooks secret; null = accept unsigned (local dev only). */
  readonly secret: string | null;
  readonly recordFailedLogin: AuditTrailUseCases['recordFailedLogin'];
};

const hookSecretBytes = (secret: string): Buffer => {
  const base64 = secret.replace(/^v1,/, '').replace(/^whsec_/, '');
  return Buffer.from(base64, 'base64');
};

export const verifyStandardWebhook = (input: {
  readonly secret: string;
  readonly id: string;
  readonly timestamp: string;
  readonly signatureHeader: string;
  readonly body: string;
}): boolean => {
  const expected = createHmac('sha256', hookSecretBytes(input.secret))
    .update(`${input.id}.${input.timestamp}.${input.body}`)
    .digest('base64');
  // header carries space-separated `v1,<base64>` entries
  return input.signatureHeader.split(' ').some((entry) => {
    const candidate = entry.replace(/^v1,/, '');
    const a = Buffer.from(candidate);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
};

type PasswordVerificationPayload = {
  readonly user_id?: string;
  readonly valid?: boolean;
};

export const handlePasswordVerificationHook = async (
  deps: AuthHookDeps,
  c: Context,
): Promise<Response> => {
  const body = await c.req.text();
  if (deps.secret) {
    const verified = verifyStandardWebhook({
      secret: deps.secret,
      id: c.req.header('webhook-id') ?? '',
      timestamp: c.req.header('webhook-timestamp') ?? '',
      signatureHeader: c.req.header('webhook-signature') ?? '',
      body,
    });
    if (!verified) {
      return c.json({ error: { message: 'invalid signature' } }, 401);
    }
  }

  let payload: PasswordVerificationPayload;
  try {
    payload = JSON.parse(body) as PasswordVerificationPayload;
  } catch {
    return c.json({ error: { message: 'invalid payload' } }, 400);
  }

  if (payload.valid === false) {
    await deps.recordFailedLogin({
      identifier: payload.user_id ?? 'unknown',
    });
  }
  // GoTrue expects 200 + {} to let the (failed or successful) flow continue.
  return c.json({});
};
