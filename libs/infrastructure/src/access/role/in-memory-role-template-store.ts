import type { RoleTemplateStore } from '@acme/application';
import type { RoleTemplate } from '@acme/domain';
import type { AccessStoreState } from '../in-memory-access-seed';

/**
 * In-memory {@link RoleTemplateStore} over the shared {@link AccessStoreState} —
 * the reference the Postgres adapter is contract-tested against. It holds only
 * staff *overrides*; the code catalogue is merged over it in the use case, so an
 * empty store means "every template is pristine" and the keys are the code keys.
 */
export const createInMemoryRoleTemplateStore = (
  state: AccessStoreState,
): RoleTemplateStore => ({
  list: async () => [...state.roleTemplates.values()],
  findByKey: async (key: string) => state.roleTemplates.get(key) ?? null,
  upsert: async (template: RoleTemplate) => {
    state.roleTemplates.set(template.key, template);
  },
});
