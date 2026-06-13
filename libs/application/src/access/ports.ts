import type {
  AccessActor,
  AccessGrant,
  AccessGrantExpired,
  SessionId,
} from '@acme/domain';

/**
 * Sliding-session bookkeeping: persists the renewed expiry computed by the
 * domain (`slideAccessSessionExpiry`) plus the activity timestamp. Plain
 * bookkeeping — not a sensitive mutation, so no audit event rides along.
 * Adapters must never extend a session that is no longer active.
 */
export type AccessSessionActivity = {
  readonly sessionId: SessionId;
  readonly lastSeenAt: string;
  readonly expiresAt: string;
  /** Refreshes the session's last-known origin (null = unknown). */
  readonly ipAddress: string | null;
};

export type AccessSessionActivityRecorder = {
  readonly recordSessionActivity: (
    activity: AccessSessionActivity,
  ) => Promise<void>;
};

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
