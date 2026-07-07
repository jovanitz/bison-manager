import type { FlowCommand } from '../../registry-types';
import type { DashboardFlowDeps } from '../flow-catalog';
import {
  changePlanInput,
  createPlanInput,
  empty,
  extendTrialInput,
  markPaidInput,
  planTargetInput,
  previewPlanInput,
  setOverrideInput,
  updatePlanInput,
} from '../registry-inputs';
import { loadPlansCatalog } from './plans';
import {
  changePlan,
  createPlan,
  extendTrial,
  markPaid,
  previewPlanUpdate,
  resetPlan,
  retirePlan,
  setDefaultPlan,
  setOverride,
  updatePlan,
} from './commands';

/**
 * The billing slice of the dashboard flow catalog (ADR-0016): the staff plan
 * catalog and the manual subscription levers. Split out of `registry.ts` (the
 * `ADMIN_FLOWS` precedent) so that file stays within the file-length budget
 * while every flow stays MCP-enumerable.
 */
export const BILLING_FLOWS: ReadonlyArray<FlowCommand<DashboardFlowDeps>> = [
  {
    name: 'plans.catalog.load',
    kind: 'query',
    description:
      'Load the full plan catalog (hidden + retired, with subscriber counts) ' +
      'and whether the actor may manage plans.',
    input: empty,
    run: (deps) => loadPlansCatalog(deps),
  },
  {
    name: 'plans.create',
    kind: 'command',
    description: 'Register a new plan: entitlements, trial, optional price.',
    input: createPlanInput,
    run: (deps, input) => createPlan(deps, createPlanInput.parse(input)),
  },
  {
    name: 'plans.preview',
    kind: 'command',
    description:
      'Preview the blast radius of a plan edit before committing it.',
    input: previewPlanInput,
    run: (deps, input) =>
      previewPlanUpdate(deps, previewPlanInput.parse(input)),
  },
  {
    name: 'plans.update',
    kind: 'command',
    description:
      'Edit a plan — propagates LIVE to every subscriber (CAS-guarded).',
    input: updatePlanInput,
    run: (deps, input) => updatePlan(deps, updatePlanInput.parse(input)),
  },
  {
    name: 'plans.retire',
    kind: 'command',
    description: 'Retire a plan: frozen, closed to all new subscriptions.',
    input: planTargetInput,
    run: (deps, input) => retirePlan(deps, planTargetInput.parse(input)),
  },
  {
    name: 'plans.reset',
    kind: 'command',
    description: 'Restore a plan to its code floor (a mass live-edit).',
    input: planTargetInput,
    run: (deps, input) => resetPlan(deps, planTargetInput.parse(input)),
  },
  {
    name: 'plans.setDefault',
    kind: 'command',
    description: 'Move the default-for-new-orgs marker to a public plan.',
    input: planTargetInput,
    run: (deps, input) => setDefaultPlan(deps, planTargetInput.parse(input)),
  },
  {
    name: 'billing.markPaid',
    kind: 'command',
    description: 'Staff lever: mark an org paid through an absolute date.',
    input: markPaidInput,
    run: (deps, input) => markPaid(deps, markPaidInput.parse(input)),
  },
  {
    name: 'billing.extendTrial',
    kind: 'command',
    description: "Staff lever: set an org's trial end to an absolute date.",
    input: extendTrialInput,
    run: (deps, input) => extendTrial(deps, extendTrialInput.parse(input)),
  },
  {
    name: 'billing.changePlan',
    kind: 'command',
    description: 'Staff lever: move an org to another (non-retired) plan.',
    input: changePlanInput,
    run: (deps, input) => changePlan(deps, changePlanInput.parse(input)),
  },
  {
    name: 'billing.setOverride',
    kind: 'command',
    description:
      'Staff lever: set (or clear) the per-org entitlement exception.',
    input: setOverrideInput,
    run: (deps, input) => setOverride(deps, setOverrideInput.parse(input)),
  },
];
