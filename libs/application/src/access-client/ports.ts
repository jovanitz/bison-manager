import type { Result, TaggedError } from '@acme/shared';
import type { CurrentAccessDto } from '../access/dto';

/**
 * Client-side view of the access system. On SPA/native, authorization lives
 * server-side (the API resolves the actor per request); the client only
 * *reads* its computed access snapshot to gate what it renders. This port is
 * implemented by an adapter that calls the API's `access.current` procedure
 * with the bearer token attached.
 */
export type CurrentAccessGateway = {
  readonly fetchCurrentAccess: () => Promise<
    Result<
      CurrentAccessDto,
      TaggedError<'app/access-gateway-error' | 'app/access-denied'>
    >
  >;
  /**
   * "Log me out everywhere": revokes every active session of the CALLER's own
   * membership through the API (the adapter resolves the membership first).
   * The current session dies too — follow with a fresh sign-in.
   */
  readonly revokeOwnSessions: () => Promise<
    Result<
      { readonly revoked: number },
      TaggedError<'app/access-gateway-error' | 'app/access-denied'>
    >
  >;
};
