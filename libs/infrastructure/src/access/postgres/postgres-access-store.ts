import postgres from 'postgres';
import type {
  AccessActorReader,
  AccessAdminRepository,
  AccessAuditTrail,
  AccessGrantExpiryRecorder,
  AccessGrantRepository,
  CustomerDirectory,
  IdentityOnboardingRepository,
} from '@acme/application';
import { createPostgresActorReader } from './actor-reader';
import { createPostgresAdminRepository } from './admin-repository';
import {
  createPostgresAuditTrail,
  createPostgresCustomerDirectory,
} from './audit-and-directory';
import {
  createPostgresGrantExpiryRecorder,
  createPostgresGrantRepository,
} from './grant-repository';
import { createPostgresIdentityOnboarding } from './identity-onboarding';

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
  readonly onboarding: IdentityOnboardingRepository;
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
    onboarding: createPostgresIdentityOnboarding(sql),
    close: () => sql.end(),
  };
};
