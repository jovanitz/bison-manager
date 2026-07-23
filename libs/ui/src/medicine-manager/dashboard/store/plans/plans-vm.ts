import type {
  CreatePlanDto,
  PlanChangesDto,
  PlanDto,
  PlanPriceDto,
  PlansCatalogViewModel,
} from '@acme/application';
import type {
  PlanDraft,
  PlanPrice,
  PlanRow,
  PlansVM,
} from '../../plans/plans.types';

/**
 * Pure mappers between the application billing DTOs and the UI's Plans VM
 * (ADR-0016). Two asymmetries the wire enforces are bridged here:
 *  - `PlanDto`/`PlanChangesDto` nest limits+features under `entitlements`, but
 *    `CreatePlanDto` flattens them to top-level `limits` + `features`.
 *  - the DTO calls the default marker `isDefaultForNewOrgs`; the VM says
 *    `isDefault`; the DTO carries a `version` CAS token the VM never shows.
 * The store keeps the raw DTOs for that version + change-building; the view only
 * ever sees `PlanRow`.
 */

const toPrice = (p: PlanPriceDto | null): PlanPrice | null =>
  p === null
    ? null
    : {
        amountCents: p.amountCents,
        currency: p.currency,
        interval: p.interval === 'year' ? 'year' : 'month',
      };

const toPriceDto = (p: PlanPrice | null): PlanPriceDto | null =>
  p === null
    ? null
    : {
        amountCents: p.amountCents,
        currency: p.currency,
        interval: p.interval,
      };

export const toPlanRow = (dto: PlanDto): PlanRow => ({
  planId: dto.id,
  key: dto.key,
  displayName: dto.displayName,
  internalNote: dto.internalNote,
  status: dto.status,
  visibility: dto.visibility,
  isDefault: dto.isDefaultForNewOrgs,
  price: toPrice(dto.price),
  trialMonths: dto.trialMonths,
  maxOrganizationsOwned: dto.entitlements.limits.maxOrganizationsOwned,
  maxMembersPerOrg: dto.entitlements.limits.maxMembersPerOrg,
  features: dto.entitlements.features,
  // `subscribers` is enriched by the flow; a plan whose count failed carries 0.
  subscribers: dto.subscribers ?? 0,
});

export const toPlansVM = (cat: PlansCatalogViewModel): PlansVM => ({
  plans: cat.plans.map(toPlanRow),
  loading: false,
  canManage: cat.canManage,
});

/** Edit submits a full replacement of the staff-editable fields. */
export const draftToChanges = (draft: PlanDraft): PlanChangesDto => ({
  displayName: draft.displayName,
  internalNote: draft.internalNote,
  visibility: draft.visibility,
  trialMonths: draft.trialMonths,
  price: toPriceDto(draft.price),
  entitlements: {
    limits: {
      maxOrganizationsOwned: draft.maxOrganizationsOwned,
      maxMembersPerOrg: draft.maxMembersPerOrg,
    },
    features: draft.features,
  },
});

/** Create flattens the entitlements and carries the audited reason inline. */
export const draftToCreateDto = (
  draft: PlanDraft,
  reason: string,
): CreatePlanDto => ({
  key: draft.key,
  displayName: draft.displayName,
  internalNote: draft.internalNote,
  visibility: draft.visibility,
  price: toPriceDto(draft.price),
  trialMonths: draft.trialMonths,
  limits: {
    maxOrganizationsOwned: draft.maxOrganizationsOwned,
    maxMembersPerOrg: draft.maxMembersPerOrg,
  },
  features: draft.features,
  reason,
});

/** A blank draft — what "Create plan" opens with. */
export const blankDraft: PlanDraft = {
  displayName: '',
  key: '',
  internalNote: '',
  visibility: 'public',
  price: null,
  trialMonths: 0,
  maxOrganizationsOwned: null,
  maxMembersPerOrg: null,
  features: [],
};

/** Seed an edit draft from a catalog row (pure — the store reuses it). */
export const draftFromRow = (row: PlanRow): PlanDraft => ({
  displayName: row.displayName,
  key: row.key,
  internalNote: row.internalNote,
  visibility: row.visibility,
  price: row.price,
  trialMonths: row.trialMonths,
  maxOrganizationsOwned: row.maxOrganizationsOwned,
  maxMembersPerOrg: row.maxMembersPerOrg,
  features: row.features,
});
