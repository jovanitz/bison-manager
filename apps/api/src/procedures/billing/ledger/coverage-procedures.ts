import { z } from 'zod';
import { ok } from '@acme/shared';
import { coverageToDto } from '@acme/application';
import type { BillingLedgerUseCases } from '@acme/application';
import { defineApiProcedure } from '../../../rpc/procedure';
import type { ApiProcedure } from '../../../rpc/procedure';

/**
 * The billing-ledger read the staff Directory + org-detail consume (ADR-0018):
 * derived coverage — paid-through / balance / phase / dormant. Wraps the
 * `getCoverage` use case, which reauthorizes `billing.read` (the pipeline
 * doesn't enforce `action` — the handler does) and 404s an org with no
 * subscription; the result is flattened to a `CoverageDto`. The client
 * coverage gateway is fail-soft, collapsing any denial/absence to null.
 */
export const createCoverageProcedures = (
  getCoverage: BillingLedgerUseCases['getCoverage'],
): ReadonlyArray<ApiProcedure> => [
  defineApiProcedure({
    name: 'billing.coverage',
    summary:
      "Read one org's derived billing coverage: paid-through, outstanding " +
      'balance, lifecycle phase (grace/suspended/…) and the dormant flag.',
    action: 'billing.read',
    input: z.object({ accountId: z.string().min(1) }).strict(),
    handler: async ({ actor, input }) => {
      const result = await getCoverage({ actor, accountId: input.accountId });
      if (!result.ok) return result;
      const { coverage, planName } = result.value;
      return ok(coverageToDto(coverage, planName));
    },
  }),
];
