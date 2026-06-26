import postgres from 'postgres';
import type {
  AccessActorReader,
  AccessAdminRepository,
  AccessAuditTrail,
  AccessBlockStore,
  AccessGrantExpiryRecorder,
  AccessGrantRepository,
  AccessInvitationStore,
  AccessMemberDirectory,
  AccessSessionActivityRecorder,
  AccessSessionPolicyStore,
  CustomerDirectory,
  IdentityOnboardingRepository,
  RoleStore,
  RoleTemplateStore,
  StaffDirectory,
} from '@acme/application';
import { createPostgresActorReader } from './actor-reader';
import { createPostgresAdminRepository } from './admin/admin-repository';
import { createPostgresBlockStore } from './block/block-store';
import {
  createPostgresAuditTrail,
  createPostgresCustomerDirectory,
  createPostgresStaffDirectory,
} from './audit-and-directory';
import {
  createPostgresGrantExpiryRecorder,
  createPostgresGrantRepository,
} from './grant-repository';
import { createPostgresInvitationStore } from './identity/invitations';
import { createPostgresMemberDirectory } from './identity/members';
import { createPostgresIdentityOnboarding } from './identity/onboarding';
import { createPostgresRoleStore } from './role/role-store';
import { createPostgresRoleTemplateStore } from './role/role-template-store';
import {
  createPostgresSessionActivityRecorder,
  createPostgresSessionPolicyStore,
} from './session-policy';

/**
 * The Postgres/Supabase implementation of every access port — same shape as
 * `createInMemoryAccessStore`, same contract test. The connection string is
 * the *service* connection (bypasses RLS): authorization is enforced in the
 * application layer per request; RLS is the second line of defense for
 * clients that talk to PostgREST directly.
 *
 * `close()` drains the pool — call it on app shutdown (and afterAll in specs).
 */
export type PostgresAccessStore = {
  readonly actors: AccessActorReader;
  readonly grantExpiry: AccessGrantExpiryRecorder;
  readonly auditTrail: AccessAuditTrail;
  readonly admin: AccessAdminRepository;
  readonly grants: AccessGrantRepository;
  readonly customers: CustomerDirectory;
  readonly staffDirectory: StaffDirectory;
  readonly onboarding: IdentityOnboardingRepository;
  readonly sessionPolicies: AccessSessionPolicyStore;
  readonly sessionActivity: AccessSessionActivityRecorder;
  readonly invitations: AccessInvitationStore;
  readonly members: AccessMemberDirectory;
  readonly blocks: AccessBlockStore;
  readonly roles: RoleStore;
  readonly roleTemplates: RoleTemplateStore;
  readonly close: () => Promise<void>;
};

export const createPostgresAccessStore = (config: {
  readonly databaseUrl: string;
  readonly maxConnections?: number;
}): PostgresAccessStore => {
  const sql = postgres(config.databaseUrl, {
    max: config.maxConnections ?? 10,
    onnotice: () => undefined,
  });
  return {
    actors: createPostgresActorReader(sql),
    grantExpiry: createPostgresGrantExpiryRecorder(sql),
    auditTrail: createPostgresAuditTrail(sql),
    admin: createPostgresAdminRepository(sql),
    grants: createPostgresGrantRepository(sql),
    customers: createPostgresCustomerDirectory(sql),
    staffDirectory: createPostgresStaffDirectory(sql),
    onboarding: createPostgresIdentityOnboarding(sql),
    sessionPolicies: createPostgresSessionPolicyStore(sql),
    sessionActivity: createPostgresSessionActivityRecorder(sql),
    invitations: createPostgresInvitationStore(sql),
    members: createPostgresMemberDirectory(sql),
    blocks: createPostgresBlockStore(sql),
    roles: createPostgresRoleStore(sql),
    roleTemplates: createPostgresRoleTemplateStore(sql),
    close: () => sql.end(),
  };
};
