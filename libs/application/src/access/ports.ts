import type {
  AccessActor,
  AccessGrant,
  AccessGrantExpired,
  SessionId,
} from '@acme/domain';

/**
 * Loads the actor for a request from *persisted* state. This is the port the
 * API pipeline hits once per request: the JWT proves which session is calling,
 * this port answers what that session is currently allowed to be. Returning
 * `null` (unknown/foreign session) must fail closed upstream.
 */
export type AccessActorReader = {
  readonly findActorBySession: (
    sessionId: SessionId,
  ) => Promise<AccessActor | null>;
};

export type AccessGrantExpiryEntry = {
  readonly grant: AccessGrant;
  readonly event: AccessGrantExpired;
};

/**
 * Persists the lazy `grant.expired` recording: each entry's grant update and
 * audit event must land in one transaction (see docs/ai/security.md — an
 * unaudited sensitive mutation must be unrepresentable).
 */
export type AccessGrantExpiryRecorder = {
  readonly recordExpiry: (
    entries: ReadonlyArray<AccessGrantExpiryEntry>,
  ) => Promise<void>;
};
