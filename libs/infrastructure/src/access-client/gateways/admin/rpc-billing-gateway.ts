import { type Result, err, ok } from '@acme/shared';
import { accessDenied, accessGatewayError } from '@acme/application';
import type {
  ApiClient,
  BillingGateway,
  BillingSummaryDto,
  DirectoryGatewayError,
  PlanDto,
  PlanImpactPreviewDto,
  PlanSubscriberDto,
} from '@acme/application';

/**
 * Client-side adapter for `BillingGateway` (ADR-0016): the staff plan catalog
 * plus the manual billing levers. Calls the API's `plans.*` / `billing.*`
 * procedures through the `ApiClient` port (bearer attached); the server
 * reauthorizes every call (`plans.manage` / `billing.read`). 401/403 collapse
 * into `app/access-denied`, any other failure into a gateway error — same
 * translation as the other admin gateways.
 */
const call = async <T>(
  api: ApiClient,
  name: string,
  body: unknown,
): Promise<Result<T, DirectoryGatewayError>> => {
  const response = await api.request<{ readonly data: T }>({
    operation: name,
    method: 'POST',
    path: `rpc/${name}`,
    body,
  });
  if (!response.ok) {
    if (response.error.status === 401 || response.error.status === 403) {
      return err(accessDenied(`Not authorized for ${name}.`));
    }
    return err(accessGatewayError(response.error.message));
  }
  return ok(response.value.data);
};

/** The levers return `data: null`; the port promises `void` — drop the body. */
const command = async (
  api: ApiClient,
  name: string,
  body: unknown,
): Promise<Result<void, DirectoryGatewayError>> => {
  const result = await call<unknown>(api, name, body);
  if (!result.ok) return result;
  return ok(undefined);
};

export const createRpcBillingGateway = (deps: {
  readonly api: ApiClient;
}): BillingGateway => ({
  listPlans: () => call<ReadonlyArray<PlanDto>>(deps.api, 'plans.list', {}),
  createPlan: (input) => call<PlanDto>(deps.api, 'plans.create', input),
  previewPlanUpdate: (input) =>
    call<PlanImpactPreviewDto>(deps.api, 'plans.preview', input),
  updatePlan: (input) => call<PlanDto>(deps.api, 'plans.update', input),
  retirePlan: (input) => call<PlanDto>(deps.api, 'plans.retire', input),
  resetPlan: (input) => call<PlanDto>(deps.api, 'plans.reset', input),
  setDefaultPlan: (input) => command(deps.api, 'plans.setDefault', input),
  listSubscribers: (planId) =>
    call<ReadonlyArray<PlanSubscriberDto>>(deps.api, 'plans.subscribers', {
      planId,
    }),
  getSummary: (accountId) =>
    call<BillingSummaryDto>(deps.api, 'billing.summary', { accountId }),
  markPaid: (input) => command(deps.api, 'billing.markPaid', input),
  extendTrial: (input) => command(deps.api, 'billing.extendTrial', input),
  changePlan: (input) => command(deps.api, 'billing.changePlan', input),
  setOverride: (input) => command(deps.api, 'billing.setOverride', input),
});
