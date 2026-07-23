import type { SessionPoliciesDto } from '@acme/application';
import type { SessionPolicyForm } from '../../settings/settings.view';

/** Pure mappers between the session-policy DTO (per-kind idle + max, in ms) and
 *  the flat form the view edits. */

export const EMPTY_POLICY: SessionPolicyForm = {
  customerIdle: 0,
  customerMax: 0,
  staffIdle: 0,
  staffMax: 0,
};

export const policiesToForm = (p: SessionPoliciesDto): SessionPolicyForm => ({
  customerIdle: p.customer.idleTtlMs,
  customerMax: p.customer.maxLifetimeMs,
  staffIdle: p.staff.idleTtlMs,
  staffMax: p.staff.maxLifetimeMs,
});

export const formToPolicies = (f: SessionPolicyForm): SessionPoliciesDto => ({
  customer: { idleTtlMs: f.customerIdle, maxLifetimeMs: f.customerMax },
  staff: { idleTtlMs: f.staffIdle, maxLifetimeMs: f.staffMax },
});
