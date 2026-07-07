import type { Result } from '@acme/shared';
import type { DirectoryGatewayError } from './ports';

/**
 * Client-side view of the billing system (ADR-0016). Mirrors the API's
 * `plans.*` / `billing.*` procedures 1:1 — the server reauthorizes every call
 * (`plans.manage` for the catalog + levers, `billing.read` for the summary);
 * the client only renders what it gets back. Lives beside `admin-ports.ts` /
 * `roles-ports.ts` (same gateway-error convention: 401/403 collapse to
 * `app/access-denied`, anything else to `app/access-gateway-error`).
 */

type GatewayResult<T> = Promise<Result<T, DirectoryGatewayError>>;

export type PlanPriceDto = {
  /** Integer cents, strictly positive — a free plan has `price: null`. */
  readonly amountCents: number;
  readonly currency: string;
  readonly interval: string;
};

export type PlanLimitsDto = {
  readonly maxOrganizationsOwned: number | null;
  readonly maxMembersPerOrg: number | null;
};

export type PlanEntitlementsDto = {
  readonly limits: PlanLimitsDto;
  readonly features: ReadonlyArray<string>;
};

/** One catalog row as `plans.list` returns it (the serialized domain Plan). */
export type PlanDto = {
  readonly id: string;
  /** Stable slug, unique by store; customers only ever see `displayName`. */
  readonly key: string;
  readonly displayName: string;
  /** Staff-facing "why this plan exists" note — required by ADR-0016. */
  readonly internalNote: string;
  readonly status: 'active' | 'retired';
  readonly visibility: 'public' | 'hidden';
  readonly isDefaultForNewOrgs: boolean;
  readonly entitlements: PlanEntitlementsDto;
  readonly trialMonths: number;
  readonly price: PlanPriceDto | null;
  readonly priceSetAt: string | null;
  /** Optimistic-concurrency token — echo it back as `expectedVersion`. */
  readonly version: number;
  /** NOT on the wire — the plans flow enriches it via `plans.subscribers`. */
  readonly subscribers?: number;
};

/** Blast radius of a plan edit, from `plans.preview` (confirm-before-commit). */
export type PlanImpactPreviewDto = {
  readonly subscribers: number;
  readonly wouldGoOverLimit: number;
  readonly wouldLoseFeature: number;
};

/** One subscribed org, from the `plans.subscribers` staff instrument. */
export type PlanSubscriberDto = {
  readonly accountId: string;
  readonly since: string;
};

/** The staff-editable subset of a plan (mirrors the domain's `PlanChanges`). */
export type PlanChangesDto = {
  readonly displayName?: string;
  readonly internalNote?: string;
  readonly visibility?: 'public' | 'hidden';
  readonly entitlements?: PlanEntitlementsDto;
  readonly trialMonths?: number;
  readonly price?: PlanPriceDto | null;
};

/** Payload of `plans.create` — reason is audited verbatim, like every lever. */
export type CreatePlanDto = {
  readonly key: string;
  readonly displayName: string;
  readonly internalNote: string;
  readonly visibility: 'public' | 'hidden';
  readonly price: PlanPriceDto | null;
  readonly trialMonths: number;
  readonly limits: PlanLimitsDto;
  readonly features: ReadonlyArray<string>;
  readonly reason: string;
};

/** The per-org exception valve: partial entitlements, or null to clear. */
export type PlanOverridesDto = {
  readonly limits?: PlanLimitsDto;
  readonly features?: ReadonlyArray<string>;
} | null;

/** One org's billing state, from `billing.summary` — everything is derived
 * server-side (phase, seats, hold), so the client never re-computes it. */
export type BillingSummaryDto = {
  readonly accountId: string;
  readonly planId: string;
  readonly planKey: string;
  /** Customer-facing name — customers never see the plan `key`. */
  readonly planName: string;
  readonly phase: 'trialing' | 'active' | 'past_due' | 'canceled';
  readonly trialEndsAt: string;
  readonly paidThroughAt: string | null;
  readonly seats: { readonly used: number; readonly max: number | null };
  readonly overLimit: boolean;
  readonly price: PlanPriceDto | null;
  readonly features: ReadonlyArray<string>;
  readonly heldForPayment: boolean;
};

/**
 * Authenticated billing administration for the dashboard (and the customer's
 * own `billing.summary` read). Plan mutations return the fresh row (with the
 * bumped `version`); the manual levers return nothing — reload the summary.
 */
export type BillingGateway = {
  readonly listPlans: () => GatewayResult<ReadonlyArray<PlanDto>>;
  readonly createPlan: (input: CreatePlanDto) => GatewayResult<PlanDto>;
  readonly previewPlanUpdate: (input: {
    readonly planId: string;
    readonly changes: PlanChangesDto;
  }) => GatewayResult<PlanImpactPreviewDto>;
  readonly updatePlan: (input: {
    readonly planId: string;
    readonly changes: PlanChangesDto;
    readonly expectedVersion: number;
    readonly reason: string;
  }) => GatewayResult<PlanDto>;
  readonly retirePlan: (input: {
    readonly planId: string;
    readonly reason: string;
  }) => GatewayResult<PlanDto>;
  readonly resetPlan: (input: {
    readonly planId: string;
    readonly reason: string;
  }) => GatewayResult<PlanDto>;
  readonly setDefaultPlan: (input: {
    readonly planId: string;
    readonly reason: string;
  }) => GatewayResult<void>;
  readonly listSubscribers: (
    planId: string,
  ) => GatewayResult<ReadonlyArray<PlanSubscriberDto>>;
  readonly getSummary: (accountId: string) => GatewayResult<BillingSummaryDto>;
  readonly markPaid: (input: {
    readonly accountId: string;
    readonly paidThrough: string;
    readonly amountNote?: string;
    readonly reason: string;
  }) => GatewayResult<void>;
  readonly extendTrial: (input: {
    readonly accountId: string;
    readonly trialEndsAt: string;
    readonly reason: string;
  }) => GatewayResult<void>;
  readonly changePlan: (input: {
    readonly accountId: string;
    readonly planId: string;
    readonly reason: string;
  }) => GatewayResult<void>;
  readonly setOverride: (input: {
    readonly accountId: string;
    readonly overrides: PlanOverridesDto;
    readonly reason: string;
  }) => GatewayResult<void>;
};
