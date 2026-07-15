import { fixedClock, sequentialIdGenerator } from '@acme/shared';
import {
  createInMemoryNotificationSender,
  type InMemoryBillingSeed,
  type InMemoryNotificationSender,
} from '@acme/infrastructure';
import { createApiRuntime } from '../composition-root';
import type { ApiProcedure } from '../rpc/procedure';
import { seedBillingWorld, seedWorld } from '../seed';

/**
 * Shared harness for the rpc contract specs: the standard seeded world (with
 * its billing companion), a frozen clock, deterministic grant ids
 * ('grant-1', …) and a helper to call a procedure as a given session.
 * Spec-only by convention (not exported anywhere), like infrastructure's
 * contract-test helpers.
 */
export const TEST_NOW = '2026-06-09T12:00:00.000Z';
export const TEST_SESSION_EXPIRES = '2026-06-09T18:00:00.000Z';
export const TEST_SESSION_CREATED = '2026-06-09T11:00:00.000Z';

export const testRuntime = (
  options: {
    /** Replace the standard billing companion (feature-gate contracts). */
    readonly billingSeed?: InMemoryBillingSeed;
    /** Probe procedures appended to the registry (pipeline contracts). */
    readonly extraProcedures?: ReadonlyArray<ApiProcedure>;
    /** Capture outbound email so specs can assert on what was actually sent. */
    readonly notifications?: InMemoryNotificationSender;
  } = {},
) =>
  createApiRuntime({
    notifications: options.notifications ?? createInMemoryNotificationSender(),
    appBaseUrl: 'https://app.test',
    seed: seedWorld({
      sessionExpiresAt: TEST_SESSION_EXPIRES,
      sessionCreatedAt: TEST_SESSION_CREATED,
    }),
    billingSeed: options.billingSeed ?? seedBillingWorld(),
    ...(options.extraProcedures
      ? { extraProcedures: options.extraProcedures }
      : {}),
    clock: fixedClock(new Date(TEST_NOW)),
    ids: sequentialIdGenerator('grant'),
  });

export type TestApp = ReturnType<typeof testRuntime>['app'];

export const callRpc = (
  app: TestApp,
  procedure: string,
  options: { readonly token?: string; readonly body?: unknown } = {},
) =>
  app.request(`/rpc/${procedure}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: JSON.stringify(options.body ?? {}),
  });

export type RpcErrorBody = {
  readonly error: { readonly tag: string; readonly message: string };
};

export const errorTag = async (res: Response): Promise<string> => {
  const body = (await res.json()) as RpcErrorBody;
  return body.error.tag;
};
