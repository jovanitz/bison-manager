/**
 * UI-local types for the staff Roles + Templates catalog (ADR-0011/0013/0014),
 * decoupled from the application DTOs so wiring maps INTO them (zero-rework).
 * Import-free.
 *
 * Honest to the contract: a platform role has NO scope of its own — only an
 * `accountId` (this screen lists platform roles) and per-permission scopes.
 * `isDefault` = it came from a factory template (resettable, not deletable);
 * `synced = false` = a default that was edited away from its template (forked).
 * Templates DO carry a scope ('platform' | 'org').
 */

/** One granted permission — a plain action + scope pair (both free strings). */
export type Permission = {
  readonly action: string;
  readonly scope: string;
};

/** A platform role as the staff catalog lists it. */
export type RoleRow = {
  readonly id: string;
  readonly name: string;
  readonly permissions: readonly Permission[];
  /** From a factory template — resettable, never deletable. */
  readonly isDefault: boolean;
  /** For a default role: false = forked (edited away from its template). */
  readonly synced: boolean;
};

/** What the create/edit role form edits and submits. */
export type RoleDraft = {
  readonly name: string;
  readonly permissions: readonly Permission[];
};

/** An open create/edit role dialog — the dialog being open is VM data. */
export type RoleFormVM = {
  readonly mode: 'create' | 'edit';
  readonly roleId: string | null;
  readonly draft: RoleDraft;
  /** The write is in flight — the submit spins, inputs lock. */
  readonly submitting?: boolean | undefined;
  /** The write failed — shown inline so the staff can retry. */
  readonly error?: string | undefined;
};

/** Delete = only custom roles; the server refuses while still assigned. */
export type DeleteRoleVM = {
  readonly roleId: string;
  readonly name: string;
  readonly deleting?: boolean | undefined;
  /** e.g. "still assigned — reassign its members first" (roleInUse). */
  readonly error?: string | undefined;
};

/** Reset = a default role back to its factory template (ADR-0012). */
export type ResetRoleVM = {
  readonly roleId: string;
  readonly name: string;
  readonly resetting?: boolean | undefined;
  readonly error?: string | undefined;
};

export type RolesVM = {
  readonly roles: readonly RoleRow[];
  readonly canManage: boolean;
  readonly loading: boolean;
  readonly error?: string | undefined;
  /** A one-off info banner (e.g. the result of a mass action). */
  readonly notice?: string | undefined;
  readonly form?: RoleFormVM | undefined;
  readonly pendingDelete?: DeleteRoleVM | undefined;
  readonly pendingReset?: ResetRoleVM | undefined;
};

export type RolesActions = {
  readonly onCreate: () => void;
  readonly onEdit: (roleId: string) => void;
  readonly onSubmitForm: (draft: RoleDraft) => void;
  readonly onCancelForm: () => void;
  readonly onDelete: (roleId: string) => void;
  readonly onConfirmDelete: () => void;
  readonly onCancelDelete: () => void;
  readonly onReset: (roleId: string) => void;
  readonly onConfirmReset: () => void;
  readonly onCancelReset: () => void;
};

// ── Templates ──────────────────────────────────────────────────────────────

export type TemplateScope = 'platform' | 'org';

/** A default-role template as the staff catalog lists it. */
export type TemplateRow = {
  readonly key: string;
  readonly name: string;
  readonly scope: TemplateScope;
  readonly permissions: readonly Permission[];
};

export type TemplateDraft = {
  readonly name: string;
  readonly permissions: readonly Permission[];
};

/** An open edit-template dialog — the key + scope are read-only context. */
export type TemplateFormVM = {
  readonly key: string;
  readonly scope: TemplateScope;
  readonly draft: TemplateDraft;
  readonly submitting?: boolean | undefined;
  readonly error?: string | undefined;
};

/** Reset = a template back to its code definition (ADR-0013). */
export type ResetTemplateVM = {
  readonly key: string;
  readonly name: string;
  readonly resetting?: boolean | undefined;
  readonly error?: string | undefined;
};

/**
 * Apply-to-all = force EVERY live instance of a template (including org-forked
 * ones) back to it (ADR-0014). The heaviest blast radius on this screen, so it
 * gets a confirm; on success the count surfaces via the view's `notice`.
 */
export type ApplyToAllVM = {
  readonly key: string;
  readonly name: string;
  readonly applying?: boolean | undefined;
  readonly error?: string | undefined;
};

export type TemplatesVM = {
  readonly templates: readonly TemplateRow[];
  readonly canManage: boolean;
  readonly loading: boolean;
  readonly error?: string | undefined;
  readonly notice?: string | undefined;
  readonly form?: TemplateFormVM | undefined;
  readonly pendingReset?: ResetTemplateVM | undefined;
  readonly pendingApply?: ApplyToAllVM | undefined;
};

export type TemplatesActions = {
  readonly onEdit: (key: string) => void;
  readonly onSubmitForm: (draft: TemplateDraft) => void;
  readonly onCancelForm: () => void;
  readonly onReset: (key: string) => void;
  readonly onConfirmReset: () => void;
  readonly onCancelReset: () => void;
  readonly onApplyToAll: (key: string) => void;
  readonly onConfirmApply: () => void;
  readonly onCancelApply: () => void;
};

/** A partial-draft updater — what the shared editor's controlled inputs call. */
export type PermissionsPatch = (permissions: readonly Permission[]) => void;
