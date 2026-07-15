import type { Clock, IdGenerator } from '@acme/shared';
import { makeIdentityUseCases } from '@acme/application';
import type { IdentityDeps } from '@acme/application';
import { createSupabaseTokenVerifier } from '../identity/token-verifier';
import type { ApiIdentityPipeline } from '../rpc/actor-middleware';
import type { ApiConfig } from './config';
import { toVerifierConfig } from './config';

/**
 * The identity pipeline: verify a real Supabase JWT, then onboard/refresh the
 * session behind it. `undefined` when no verifier is configured — that is the
 * dev/test stub where the bearer token IS the session id, and the actor
 * middleware falls back to it.
 */
export const wireIdentity = (
  config: ApiConfig,
  deps: Omit<IdentityDeps, 'bootstrapOwnerEmail'> & {
    readonly clock: Clock;
    readonly ids: IdGenerator;
  },
): ApiIdentityPipeline | undefined => {
  const verifierConfig = toVerifierConfig(config);
  if (!verifierConfig) return undefined;
  return {
    verifier: createSupabaseTokenVerifier(verifierConfig),
    registerSession: makeIdentityUseCases({
      ...deps,
      bootstrapOwnerEmail: config.bootstrapOwnerEmail ?? null,
    }).registerIdentitySession,
  };
};
