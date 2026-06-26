import { createStore } from 'zustand/vanilla';
import {
  type AccessClientUseCases,
  type AuditGateway,
  type AuditViewModel,
  loadAuditTrail,
} from '@acme/application';

/** Reactive store for the dashboard's audit-trail view (read-only). Dumb. */
export type AuditStoreState = {
  readonly vm: AuditViewModel | null;
  readonly error: string | null;
  readonly load: () => Promise<void>;
};

export type AuditStoreDeps = {
  readonly access: AccessClientUseCases;
  readonly audit: AuditGateway;
};

export const createAuditStore = (deps: AuditStoreDeps) =>
  createStore<AuditStoreState>((set) => ({
    vm: null,
    error: null,
    load: async () => {
      const result = await loadAuditTrail(deps);
      set(
        result.ok
          ? { vm: result.value, error: null }
          : { error: result.error.message },
      );
    },
  }));

export type AuditStore = ReturnType<typeof createAuditStore>;
