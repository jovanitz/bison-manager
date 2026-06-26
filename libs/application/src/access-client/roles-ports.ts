import type { Result } from '@acme/shared';
import type { DirectoryGatewayError } from './ports';

/** A role as the dashboard lists it (ADR-0011); permissions are plain pairs. */
export type RoleSummaryDto = {
  readonly id: string;
  readonly name: string;
  readonly accountId: string | null;
  readonly permissions: ReadonlyArray<{
    readonly action: string;
    readonly scope: string;
  }>;
  /** Factory template key (ADR-0012); non-null = a default (resettable). */
  readonly templateKey: string | null;
  /** Eager-propagation state (ADR-0014): `false` = forked (org-edited). */
  readonly templateSynced: boolean;
};

/** A default-role template as the staff dashboard lists it (ADR-0013/0014). */
export type RoleTemplateDto = {
  readonly key: string;
  /** 'platform' = staff roles; 'org' = customer-org roles. */
  readonly scope: string;
  readonly name: string;
  readonly permissions: ReadonlyArray<{
    readonly action: string;
    readonly scope: string;
  }>;
};

/**
 * Client-side view of dynamic-role management (ADR-0011). Every call hits an
 * API procedure (`roles.*`/`templates.*`) with the bearer token attached; the
 * server reauthorizes each (`permissions.update`). The client only forwards.
 */
export type RolesGateway = {
  /** Platform roles (accountId null) plus the given account's own. */
  readonly listRoles: (
    accountId: string | null,
  ) => Promise<Result<ReadonlyArray<RoleSummaryDto>, DirectoryGatewayError>>;
  readonly createRole: (input: {
    readonly name: string;
    readonly accountId: string | null;
    readonly permissions: ReadonlyArray<{
      readonly action: string;
      readonly scope: string;
    }>;
  }) => Promise<Result<{ readonly roleId: string }, DirectoryGatewayError>>;
  readonly deleteRole: (
    roleId: string,
  ) => Promise<Result<void, DirectoryGatewayError>>;
  /** Reset a default role to its factory template (ADR-0012). */
  readonly resetRole: (
    roleId: string,
  ) => Promise<Result<void, DirectoryGatewayError>>;
  /**
   * Edit a role's name + permission set in place (ADR-0011): a live reference,
   * so every holder sees the change on its next request. The server refuses
   * removing the governing capability from a role still assigned.
   */
  readonly updateRole: (input: {
    readonly roleId: string;
    readonly name: string;
    readonly permissions: ReadonlyArray<{
      readonly action: string;
      readonly scope: string;
    }>;
  }) => Promise<Result<void, DirectoryGatewayError>>;
  /** Replace a membership's whole role assignment (ADR-0011, roles-only). */
  readonly assignRoles: (input: {
    readonly membershipId: string;
    readonly roleIds: ReadonlyArray<string>;
  }) => Promise<Result<void, DirectoryGatewayError>>;
  /** The default-role templates: code catalogue with staff edits (ADR-0013). */
  readonly listTemplates: () => Promise<
    Result<ReadonlyArray<RoleTemplateDto>, DirectoryGatewayError>
  >;
  /** Edit a template's name + permissions (staff-only, ADR-0013). */
  readonly updateTemplate: (input: {
    readonly key: string;
    readonly name: string;
    readonly permissions: ReadonlyArray<{
      readonly action: string;
      readonly scope: string;
    }>;
  }) => Promise<Result<void, DirectoryGatewayError>>;
  /** Reset a template to its code definition — the recovery floor (ADR-0013). */
  readonly resetTemplate: (
    key: string,
  ) => Promise<Result<void, DirectoryGatewayError>>;
  /** Force every instance of a template back to it (ADR-0014, "apply to all"). */
  readonly applyTemplateToAll: (
    key: string,
  ) => Promise<Result<{ readonly updated: number }, DirectoryGatewayError>>;
};
