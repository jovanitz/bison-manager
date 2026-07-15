import type { Clock, IdGenerator } from '@acme/shared';
import {
  makeAccessAdminUseCases,
  makeAccessMembersUseCases,
  makeAccessBlockUseCases,
  makeAccessDirectoryUseCases,
  makeAccessRolesUseCases,
  makeAccessSettingsUseCases,
  makeAccessUseCases,
  makeAuditTrailUseCases,
  makeImpersonationUseCases,
} from '@acme/application';
import type { AccessStore } from './store';

/**
 * The access bounded context, assembled in one place: actor resolution, audit,
 * account admin, the staff/customer directory, soft blocks, roles, settings and
 * impersonation. Pure composition — every rule already lives in the use cases.
 */
export const wireAccess = (deps: {
  readonly store: AccessStore;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}) => {
  const { store, clock, ids } = deps;
  return {
    access: makeAccessUseCases({
      actors: store.actors,
      grantExpiry: store.grantExpiry,
      sessionPolicies: store.sessionPolicies,
      sessionActivity: store.sessionActivity,
      clock,
    }),
    auditTrail: makeAuditTrailUseCases({ trail: store.auditTrail, clock }),
    accessAdmin: makeAccessAdminUseCases({
      admin: store.admin,
      settings: store.sessionPolicies,
      clock,
    }),
    accessDirectory: makeAccessDirectoryUseCases({
      staffDirectory: store.staffDirectory,
      clock,
    }),
    accessBlock: makeAccessBlockUseCases({
      blocks: store.blocks,
      accounts: store.admin,
      clock,
    }),
    accessRoles: makeAccessRolesUseCases({
      roles: store.roles,
      templates: store.roleTemplates,
      admin: store.admin,
      clock,
      ids,
    }),
    accessSettings: makeAccessSettingsUseCases({
      settings: store.sessionPolicies,
      clock,
    }),
    accessMembers: makeAccessMembersUseCases({
      members: store.members,
      accounts: store.admin,
      sessionPolicies: store.sessionPolicies,
      clock,
    }),
    impersonation: makeImpersonationUseCases({
      grants: store.grants,
      customers: store.customers,
      clock,
      ids,
    }),
  };
};
