import type { InMemoryAccessSeed } from '../../../access/in-memory/access-seed';
import type { AccessStorePorts } from '../access-store-fixtures';
import { roleStoreContract } from './role-store-contract';
import { roleTemplateStoreContract } from './role-template-store-contract';

/** Both role-related store contracts (ADR-0011 roles + ADR-0013 templates). */
export const roleContracts = (
  name: string,
  makeStore: (
    seed: InMemoryAccessSeed,
  ) => AccessStorePorts | Promise<AccessStorePorts>,
): void => {
  roleStoreContract(name, makeStore);
  roleTemplateStoreContract(name, makeStore);
};
