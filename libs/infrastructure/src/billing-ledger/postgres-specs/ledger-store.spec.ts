import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import type { ChargeStore, PaymentStore } from '@acme/application';
import type {
  Charge,
  ChargeId,
  Money,
  Payment,
  PaymentId,
  PlanId,
} from '@acme/domain';
import {
  POSTGRES_TEST_URL,
  acquirePostgresTestLock,
  probePostgres,
} from '../../testing/postgres-test-env';
import { createInMemoryChargeStore } from '../in-memory/in-memory-charge-store';
import { createInMemoryPaymentStore } from '../in-memory/in-memory-payment-store';
import { createPostgresChargeStore } from '../postgres/charge-store';
import { createPostgresPaymentStore } from '../postgres/payment-store';

/**
 * The SAME contract for both ledger stores (in-memory + Postgres). The pg run
 * seeds a throwaway account + plan for the FKs and cleans up after, and skips
 * visibly when the local Supabase stack is down.
 */
const ACC = randomUUID();
const PLAN = randomUUID();
const MXN = (minor: number): Money => ({ minor, currency: 'MXN' });

const testCharge = (over?: Partial<Charge>): Charge => ({
  id: randomUUID() as ChargeId,
  accountId: ACC,
  planId: PLAN as PlanId,
  period: { from: '2026-06-05T00:00:00.000Z', to: '2026-07-05T00:00:00.000Z' },
  dueDate: '2026-06-05T00:00:00.000Z',
  subtotal: MXN(4900),
  taxRateBps: 1600,
  tax: MXN(784),
  total: MXN(5684),
  graceDays: 10,
  status: 'open',
  paidAt: null,
  coveredThrough: null,
  ...over,
});

const testPayment = (over?: Partial<Payment>): Payment => ({
  id: randomUUID() as PaymentId,
  accountId: ACC,
  kind: 'payment',
  amount: MXN(5684),
  appliedTo: [],
  recordedByMembershipId: 'mem-1',
  reason: 'bank transfer',
  occurredAt: '2026-06-09T00:00:00.000Z',
  ...over,
});

type Stores = {
  readonly charges: ChargeStore;
  readonly payments: PaymentStore;
};

const contract = (name: string, make: () => Promise<Stores>): void => {
  describe(`ledger store — ${name}`, () => {
    it('round-trips charges; settlement upserts in place (no duplicate)', async () => {
      const { charges } = await make();
      const open = testCharge();
      await charges.saveMany([open]);
      expect((await charges.listByAccount(ACC)).length).toBe(1);
      await charges.saveMany([
        {
          ...open,
          status: 'paid',
          paidAt: '2026-06-09T00:00:00.000Z',
          coveredThrough: '2026-07-05T00:00:00.000Z',
        },
      ]);
      const rows = await charges.listByAccount(ACC);
      expect(rows.length).toBe(1);
      expect(rows[0]?.status).toBe('paid');
      expect(rows[0]?.coveredThrough).toBe('2026-07-05T00:00:00.000Z');
      expect(rows[0]?.total.minor).toBe(5684);
    });

    it('appends payments; findById preserves appliedTo + reversalOf', async () => {
      const { charges, payments } = await make();
      const charge = testCharge();
      await charges.saveMany([charge]);
      const paid = testPayment({ appliedTo: [charge.id] });
      await payments.append(paid);
      await payments.append(testPayment({ kind: 'void', reversalOf: paid.id }));
      const list = await payments.listByAccount(ACC);
      expect(list.length).toBe(2);
      expect((await payments.findById(paid.id))?.appliedTo).toEqual([
        charge.id,
      ]);
      const rev = list.find((p) => p.kind === 'void');
      expect(rev?.reversalOf).toBe(paid.id);
    });
  });
};

contract('in-memory', async () => ({
  charges: createInMemoryChargeStore(),
  payments: createInMemoryPaymentStore(),
}));

const available = await probePostgres();
if (available) {
  const sql = postgres(POSTGRES_TEST_URL, {
    max: 4,
    onnotice: () => undefined,
  });
  let releaseLock: (() => Promise<void>) | null = null;
  beforeAll(async () => {
    releaseLock = await acquirePostgresTestLock();
  }, 60_000);
  afterAll(async () => {
    await sql`truncate public.charges, public.payments`;
    await sql.end();
    await releaseLock?.();
  });
  const makePg = async (): Promise<Stores> => {
    await sql`
      insert into public.accounts (id, display_name, kind)
      values (${ACC}, 'Ledger Test', 'customer') on conflict (id) do nothing
    `;
    await sql`
      insert into public.plans
        (id, key, display_name, internal_note, status, visibility, is_default,
         entitlements, trial_months, version)
      values (${PLAN}, ${`ledger-${PLAN.slice(0, 8)}`}, 'Ledger Test', '',
        'active', 'hidden', false,
        '{"limits":{"maxOrganizationsOwned":1,"maxMembersPerOrg":3},"features":[]}'::jsonb,
        0, 1)
      on conflict (id) do nothing
    `;
    await sql`truncate public.charges, public.payments`;
    return {
      charges: createPostgresChargeStore(sql),
      payments: createPostgresPaymentStore(sql),
    };
  };
  contract('postgres (supabase local)', makePg);
} else {
  describe.skip('ledger store — postgres (stack down)', () => {
    it('skipped — local Supabase not running', () => {
      expect(available).toBe(false);
    });
  });
}
