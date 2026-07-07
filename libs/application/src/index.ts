// Ports (abstractions the outside world must satisfy)
export * from './ports/event-publisher';
export * from './ports/auth';
export * from './ports/api';
export * from './ports/sync';
export * from './ports/list-options';

// Example module: DTOs, ports, use cases, errors
export * from './example/dto';
export * from './example/ports';
export * from './example/errors';
export * from './example/use-cases';

// Access module: authorization core orchestration
export * from './access/dto';
export * from './access/ports';
export * from './access/errors';
export * from './access/authorize';
export * from './access/use-cases';

// Access administration: disable accounts, edit permissions, revoke sessions
export * from './access-admin/ports';
export * from './access-admin/errors';
export * from './access-admin/use-cases';

// Impersonation: support's temporary, view-only customer access
export * from './impersonation/ports';
export * from './impersonation/errors';
export * from './impersonation/use-cases';
export * from './impersonation/customer-use-cases';

// Audit trail: append-only security event log
export * from './audit-trail/ports';
export * from './audit-trail/use-cases';

// Identity: token verification port + session registration/onboarding
export * from './identity/ports';
export * from './identity/errors';
export * from './identity/use-cases';
export * from './identity/create-organization';

// Access invitations: joining an existing account, by invitation only
export * from './access-invitations/ports';
export * from './access-invitations/errors';
export * from './access-invitations/use-cases';

// Access members: managing the memberships of one account (organization)
export * from './access-members/ports';
export * from './access-members/errors';
export * from './access-members/use-cases';

// Access directory: the platform staff directory (a platform-admin read)
export * from './access-directory/ports';
export * from './access-directory/use-cases';

// Access org-detail: the customer (org) drill-down — admin summary + roster
// (members.read), distinct from impersonation (customer.read, grant-only)
export * from './access-org-detail/ports';
export * from './access-org-detail/errors';
export * from './access-org-detail/use-cases';

// Access roles: dynamic role bundles assigned to memberships (ADR-0011)
export * from './access-roles/ports';
export * from './access-roles/errors';
export * from './access-roles/use-cases';

// Billing plans: the staff-editable plan catalog (ADR-0016) — live edits with
// blast-radius preview, optimistic concurrency and before/after audit
export * from './billing-plans/ports';
export * from './billing-plans/errors';
export * from './billing-plans/use-cases';

// Billing subscriptions: per-org subscription facts + entitlement guards and
// the staff levers (mark paid / extend trial / change plan / override)
export * from './billing-subscriptions/ports';
export * from './billing-subscriptions/errors';
export * from './billing-subscriptions/guards';
export * from './billing-subscriptions/use-cases';
export * from './access-roles/expand';

// Access block: soft block of an org or an identity (login yes, operate no)
export * from './access-block/ports';
export * from './access-block/use-cases';

// Access settings: runtime-editable session policy (owner capability)
export * from './access-settings/ports';
export * from './access-settings/errors';
export * from './access-settings/use-cases';

// Access client: what a SPA/native app consumes (auth flows + gating snapshot)
export * from './access-client/ports';
export * from './access-client/roles-ports';
export * from './access-client/admin-ports';
export * from './access-client/billing-ports';
export * from './access-client/errors';
export * from './access-client/use-cases';
export * from './access-client/gateways/directory-use-cases';
export * from './access-client/gateways/invitations-use-cases';
export * from './access-client/gateways/members-use-cases';
export * from './access-client/gateways/block-use-cases';
export * from './access-client/gateways/client/orgs-use-cases';

// Flows: headless controllers + enumerable registries. The UI stores and a
// future MCP server both drive these — orchestration lives here, never in a
// component or a reactive store.
export * from './flows/capabilities';
export * from './flows/registry-types';
export * from './flows/client/org-admin';
export * from './flows/client/roles';
export * from './flows/client/home';
export * from './flows/client/gate';
export * from './flows/client/registry';
export * from './flows/dashboard/queries';
export * from './flows/dashboard/org-detail/org-detail';
export * from './flows/dashboard/plans/plans';
export * from './flows/dashboard/plans/commands';
export * from './flows/dashboard/commands';
export * from './flows/dashboard/roles';
export * from './flows/dashboard/registry';
