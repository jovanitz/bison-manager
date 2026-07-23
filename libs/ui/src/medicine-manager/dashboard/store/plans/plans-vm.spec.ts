import { describe, expect, it } from 'vitest';
import type { PlanDto, PlansCatalogViewModel } from '@acme/application';
import type { PlanDraft } from '../../plans/plans.types';
import {
  blankDraft,
  draftFromRow,
  draftToChanges,
  draftToCreateDto,
  toPlanRow,
  toPlansVM,
} from './plans-vm';

const dto: PlanDto = {
  id: 'plan_2',
  key: 'pro',
  displayName: 'Pro',
  internalNote: 'The standard paid tier.',
  status: 'active',
  visibility: 'public',
  isDefaultForNewOrgs: true,
  entitlements: {
    limits: { maxOrganizationsOwned: 3, maxMembersPerOrg: null },
    features: ['export.csv', 'reports.advanced'],
  },
  trialMonths: 1,
  price: { amountCents: 49900, currency: 'MXN', interval: 'month' },
  priceSetAt: '2026-01-01T00:00:00Z',
  version: 4,
  subscribers: 37,
};

const draft: PlanDraft = {
  displayName: 'Pro',
  key: 'pro',
  internalNote: 'note',
  visibility: 'hidden',
  price: { amountCents: 59900, currency: 'MXN', interval: 'year' },
  trialMonths: 2,
  maxOrganizationsOwned: 5,
  maxMembersPerOrg: null,
  features: ['export.csv'],
};

describe('toPlanRow', () => {
  it('flattens entitlements and renames the default marker', () => {
    const row = toPlanRow(dto);
    expect(row.planId).toBe('plan_2');
    expect(row.isDefault).toBe(true); // isDefaultForNewOrgs → isDefault
    expect(row.maxOrganizationsOwned).toBe(3);
    expect(row.maxMembersPerOrg).toBeNull(); // null = unlimited, preserved
    expect(row.features).toEqual(['export.csv', 'reports.advanced']);
    expect(row.subscribers).toBe(37);
  });

  it('defaults a missing subscriber count to 0 (not undefined)', () => {
    const noCount: PlanDto = {
      id: 'p',
      key: 'k',
      displayName: 'n',
      internalNote: 'x',
      status: 'active',
      visibility: 'public',
      isDefaultForNewOrgs: false,
      entitlements: {
        limits: { maxOrganizationsOwned: null, maxMembersPerOrg: null },
        features: [],
      },
      trialMonths: 0,
      price: null,
      priceSetAt: null,
      version: 1,
    };
    expect(toPlanRow(noCount).subscribers).toBe(0);
  });

  it('maps a null price through and narrows the interval', () => {
    expect(toPlanRow({ ...dto, price: null }).price).toBeNull();
    const yearly = toPlanRow({
      ...dto,
      price: { amountCents: 100, currency: 'MXN', interval: 'year' },
    });
    expect(yearly.price?.interval).toBe('year');
  });
});

describe('toPlansVM', () => {
  it('maps the catalog and passes canManage through, not loading', () => {
    const cat: PlansCatalogViewModel = { plans: [dto], canManage: true };
    const vm = toPlansVM(cat);
    expect(vm.loading).toBe(false);
    expect(vm.canManage).toBe(true);
    expect(vm.plans).toHaveLength(1);
    expect(vm.plans[0]?.planId).toBe('plan_2');
  });
});

describe('draft ↔ DTO', () => {
  it('draftToChanges nests limits+features under entitlements', () => {
    const changes = draftToChanges(draft);
    expect(changes.entitlements?.limits.maxOrganizationsOwned).toBe(5);
    expect(changes.entitlements?.features).toEqual(['export.csv']);
    expect(changes.price?.interval).toBe('year');
    expect(changes.visibility).toBe('hidden');
  });

  it('draftToCreateDto flattens limits and carries the audited reason', () => {
    const create = draftToCreateDto(draft, 'launching annual pro');
    // Create flattens (top-level limits+features), unlike PlanChangesDto.
    expect(create.limits.maxOrganizationsOwned).toBe(5);
    expect(create.features).toEqual(['export.csv']);
    expect(create.reason).toBe('launching annual pro');
  });

  it('draftFromRow round-trips a row back into an editable draft', () => {
    const row = toPlanRow(dto);
    const back = draftFromRow(row);
    expect(back.key).toBe('pro');
    expect(back.maxOrganizationsOwned).toBe(3);
    expect(back.features).toEqual(['export.csv', 'reports.advanced']);
  });

  it('blankDraft is an empty, price-less public draft', () => {
    expect(blankDraft.price).toBeNull();
    expect(blankDraft.visibility).toBe('public');
    expect(blankDraft.features).toEqual([]);
  });
});
