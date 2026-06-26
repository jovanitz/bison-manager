import type { Result } from '@acme/shared';
import type { DirectoryGatewayError } from './ports';

/**
 * Staff-dashboard administration gateways (ADR-0010): account lifecycle, the
 * audit trail, and active-session management. Each call hits an `account.*` /
 * `audit.*` / `sessions.*` procedure; the server re-authorizes (owner-level).
 * Split out of `ports.ts` to keep that file within the file-length budget.
 */

/** Account lifecycle: disable (hard suspend), enable, promote (one-way). */
export type AccountAdminGateway = {
  readonly disable: (
    accountId: string,
    reason?: string,
  ) => Promise<Result<void, DirectoryGatewayError>>;
  readonly enable: (
    accountId: string,
  ) => Promise<Result<void, DirectoryGatewayError>>;
  readonly promote: (
    accountId: string,
  ) => Promise<Result<void, DirectoryGatewayError>>;
};

/** One audit-trail row as the dashboard renders it (`audit.list`). */
export type AuditRecordDto = {
  readonly id: string;
  readonly event: { readonly type: string; readonly occurredAt: string };
};

/** Read the append-only security audit trail (staff `audit.read`). */
export type AuditGateway = {
  readonly list: (filter?: {
    readonly accountId?: string;
    readonly limit?: number;
  }) => Promise<Result<ReadonlyArray<AuditRecordDto>, DirectoryGatewayError>>;
};

/** A membership's session with its captured context (`sessions.list`). */
export type AdminSessionDto = {
  readonly id: string;
  readonly status: string;
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly expiresAt: string;
  readonly userAgent: string | null;
  readonly lastIp: string | null;
};

/** Session lifetime policy per account kind (`settings.*`). */
export type SessionPolicyDto = {
  readonly idleTtlMs: number;
  readonly maxLifetimeMs: number;
};
export type SessionPoliciesDto = {
  readonly customer: SessionPolicyDto;
  readonly staff: SessionPolicyDto;
};

/** Read + reconfigure the runtime session policy (staff `settings.update`). */
export type SettingsGateway = {
  readonly read: () => Promise<
    Result<
      { readonly policies: SessionPoliciesDto; readonly version: number },
      DirectoryGatewayError
    >
  >;
  readonly update: (
    policies: SessionPoliciesDto,
  ) => Promise<Result<void, DirectoryGatewayError>>;
};

/** List + revoke a membership's active sessions (staff `sessions.*`). */
export type SessionsGateway = {
  readonly list: (
    membershipId: string,
  ) => Promise<Result<ReadonlyArray<AdminSessionDto>, DirectoryGatewayError>>;
  readonly revoke: (
    sessionId: string,
  ) => Promise<Result<void, DirectoryGatewayError>>;
  readonly revokeAll: (
    membershipId: string,
  ) => Promise<Result<void, DirectoryGatewayError>>;
};
