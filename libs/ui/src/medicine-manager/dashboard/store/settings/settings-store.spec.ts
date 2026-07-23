import { describe, expect, it, vi } from 'vitest';
import { ok, err } from '@acme/shared';
import { createSettingsStore, type SettingsStoreDeps } from './settings-store';

const policies = {
  customer: { idleTtlMs: 900000, maxLifetimeMs: 28800000 },
  staff: { idleTtlMs: 1800000, maxLifetimeMs: 43200000 },
};

const snapshotWith = (permissions: readonly unknown[]) => ({
  membershipId: 'mem',
  userId: 'me@acme.test',
  accountId: 'acc-self',
  accountStatus: 'active',
  blocked: false,
  session: { id: 's', status: 'active', expiresAt: '2099-01-01T00:00:00Z' },
  permissions,
  activeGrants: [],
});

type Over = {
  readonly access?: Record<string, unknown>;
  readonly settings?: Record<string, unknown>;
};

const makeDeps = (over: Over = {}) =>
  ({
    access: over.access ?? {
      currentAccess: async () =>
        ok(snapshotWith([{ action: 'settings.update', scope: 'any' }])),
    },
    settings: {
      read: async () => ok({ policies, version: 1 }),
      update: async () => ok(undefined),
      ...(over.settings ?? {}),
    },
  }) as unknown as SettingsStoreDeps;

describe('createSettingsStore', () => {
  it('load maps the policy to the flat form and is manageable', async () => {
    const store = createSettingsStore(makeDeps());
    await store.getState().load();
    const vm = store.getState().vm;
    expect(vm.canManage).toBe(true);
    expect(vm.loading).toBe(false);
    expect(vm.policy.customerIdle).toBe(900000);
    expect(vm.policy.staffMax).toBe(43200000);
  });

  it('is read-only (hidden) without settings.update — never reads the policy', async () => {
    const read = vi.fn(async () => ok({ policies, version: 1 }));
    const store = createSettingsStore(
      makeDeps({
        access: { currentAccess: async () => ok(snapshotWith([])) },
        settings: { read },
      }),
    );
    await store.getState().load();
    expect(store.getState().vm.canManage).toBe(false);
    expect(read).not.toHaveBeenCalled(); // gated: no read without the capability
  });

  it('save pushes the whole policy (form → per-kind DTO) and notices success', async () => {
    const update = vi.fn(async () => ok(undefined));
    const store = createSettingsStore(
      makeDeps({
        settings: { read: async () => ok({ policies, version: 1 }), update },
      }),
    );
    await store.getState().load();
    await store.getState().save({
      customerIdle: 1,
      customerMax: 2,
      staffIdle: 3,
      staffMax: 4,
    });
    expect(update).toHaveBeenCalledWith({
      customer: { idleTtlMs: 1, maxLifetimeMs: 2 },
      staff: { idleTtlMs: 3, maxLifetimeMs: 4 },
    });
    expect(store.getState().vm.notice).toContain('saved');
  });

  it('surfaces a save failure inline', async () => {
    const store = createSettingsStore(
      makeDeps({
        settings: {
          read: async () => ok({ policies, version: 1 }),
          update: async () => err({ tag: 'x', message: 'boom' }),
        },
      }),
    );
    await store.getState().load();
    await store.getState().save(store.getState().vm.policy);
    expect(store.getState().vm.error).toBe('boom');
    expect(store.getState().vm.saving).toBe(false);
  });
});
