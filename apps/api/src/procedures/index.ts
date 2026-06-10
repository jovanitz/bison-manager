import type {
  AccessAdminUseCases,
  AccessUseCases,
  AuditTrailUseCases,
  ImpersonationUseCases,
} from '@acme/application';
import type { ApiProcedure } from '../rpc/procedure';
import { createAccessProcedures } from './access-procedures';
import { createAdminProcedures } from './admin-procedures';
import { createImpersonationProcedures } from './impersonation-procedures';

export type ApiUseCases = {
  readonly access: AccessUseCases;
  readonly auditTrail: AuditTrailUseCases;
  readonly accessAdmin: AccessAdminUseCases;
  readonly impersonation: ImpersonationUseCases;
};

/**
 * The declarative procedure registry — the API's entire surface in one list,
 * and the future MCP / AI-gateway tool registry. All nine access use cases
 * are declared here; nothing else is routable.
 */
export const createApiProcedures = (
  useCases: ApiUseCases,
): ReadonlyArray<ApiProcedure> => [
  ...createAccessProcedures(useCases),
  ...createAdminProcedures(useCases.accessAdmin),
  ...createImpersonationProcedures(useCases.impersonation),
];
