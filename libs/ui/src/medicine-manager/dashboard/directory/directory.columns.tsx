import type { ColumnDef } from '@tanstack/react-table';
import { Users } from 'lucide-react';
import { Avatar } from '../../../design-system/avatar/avatar';
import { Badge } from '../../../design-system/badge/badge';

/** Local row types — decoupled from application DTOs (the container maps to these). */
export type StaffRow = {
  readonly accountId: string;
  /**
   * The IDENTITY behind the account. Identity-scoped actions (block/unblock)
   * MUST key off this — `accountId` is a different id space and passing it
   * would moderate the wrong subject.
   */
  readonly userId: string;
  readonly email?: string;
  readonly displayName?: string;
  /** When the staff member was last seen — recency for "inactive" triage. */
  readonly lastActiveAt?: string;
  /** Soft block — dashboard access suspended, reversible. */
  readonly blocked?: boolean;
  /** Hard disable — the identity is off across every app. */
  readonly disabled?: boolean;
  /** The signed-in staff (you) — self-moderation is blocked. */
  readonly isSelf?: boolean;
  /** The protected root account — cannot be blocked/disabled/demoted. */
  readonly isRoot?: boolean;
};
export type CustomerRow = {
  readonly accountId: string;
  readonly displayName: string;
  readonly email?: string;
  /** How many users belong to the org — its size at a glance. */
  readonly memberCount?: number;
  /** The org's current subscription plan (display name). */
  readonly plan?: string;
  /** Billing phase — drives the health-header segments (grace/suspended/…). */
  readonly phase?: 'active' | 'trialing' | 'grace' | 'suspended' | 'canceled';
  /** When the org was created + last seen — recency for the row detail. */
  readonly createdAt?: string;
  readonly lastActiveAt?: string;
  /** How many charges are overdue (0 / undefined = current). Drives the pill. */
  readonly overduePayments?: number;
  /** Date of the last successful payment — shown in the row detail. */
  readonly lastPaymentAt?: string;
  /** Soft block — org access suspended, reversible (Block/Unblock org). */
  readonly blocked?: boolean;
  /** Hard disable — the whole account is off (Disable/Enable account). */
  readonly disabled?: boolean;
  /** Billing-suspended ~3+ months, idle → dormant (candidate for deletion review). */
  readonly dormant?: boolean;
  /** Scheduled for deletion (ADR-0018): ISO date the purge runs. Presence ⇒
   *  the org is in the reversible 30-day pending-deletion window. */
  readonly pendingDeletionUntil?: string;
};
export type InvitationStatus = 'pending' | 'expiring' | 'expired';
export type InvitationRow = {
  readonly invitationId: string;
  readonly email: string;
  readonly expiresAt: string;
  readonly status: InvitationStatus;
};
export type OrphanRow = {
  readonly userId: string;
  readonly email?: string;
  readonly createdAt: string;
};

export type DirectoryActions = {
  readonly onBlock: (accountId: string, blocked: boolean) => void;
  readonly onAdmin: (
    accountId: string,
    action: 'disable' | 'enable' | 'promote',
  ) => void;
  readonly onRegenerate: (invitationId: string) => void;
  /** Open an organization's detail (its owner + member roster). */
  readonly onOpenOrg: (accountId: string) => void;
  /** Open a staff member's access detail (permissions, roles, sessions). */
  readonly onOpenStaff: (accountId: string) => void;
  /** Invitation lifecycle. */
  readonly onResendInvite: (invitationId: string) => void;
  readonly onRevokeInvitation: (invitationId: string) => void;
  /** Orphaned identity (registered, no org). */
  readonly onInviteOrphan: (userId: string) => void;
  readonly onDeleteOrphan: (userId: string) => void;
  /** Dormant-org deletion review (ADR-0018) — a staged, reversible soft-delete. */
  readonly onScheduleDeletion: (accountId: string) => void;
  readonly onCancelDeletion: (accountId: string) => void;
  readonly onExportOrg: (accountId: string) => void;
  /** Staff moderation (root/self are guarded in the menu, not here). */
  readonly onBlockStaff: (accountId: string, blocked: boolean) => void;
  readonly onDisableStaff: (accountId: string, disabled: boolean) => void;
  readonly onDemoteStaff: (accountId: string) => void;
  /** Export the directory listing (current view or the selected rows) as CSV. */
  readonly onExportDirectory: (accountIds: readonly string[]) => void;
  /** Directory-level CTA — invite a new person by email. */
  readonly onInvite: (email: string) => void;
};

/** Directory screen ViewModel — lives here (the types hub) so the view and its
 *  parts (organizations panel) share it without a view↔part import cycle. */
export type DirectoryVM = {
  readonly staff: readonly StaffRow[];
  readonly customers: readonly CustomerRow[];
  readonly pendingInvitations: readonly InvitationRow[];
  readonly orphans: readonly OrphanRow[];
  readonly canBlock: boolean;
  readonly canAdminAccounts: boolean;
  readonly loading: boolean;
  readonly error?: string;
};

/** Up-to-2 initials for an avatar fallback. */
export const initials = (name?: string): string => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const chars = parts.slice(0, 2).map((w) => w[0] ?? '');
  return chars.join('').toUpperCase() || '?';
};

/** Human relative date vs a fixed "today" (prototype fixtures live in 2026-07). */
export const relativeDate = (iso?: string, now = '2026-07-07'): string => {
  if (!iso) return '—';
  const days = Math.round((Date.parse(iso) - Date.parse(now)) / 86_400_000);
  if (days === 0) return 'today';
  if (days === -1) return 'yesterday';
  if (days === 1) return 'tomorrow';
  return days < 0 ? `${-days} days ago` : `in ${days} days`;
};

/** A name with its avatar — the standard row identity cell. */
export const NameWithAvatar = ({
  name,
  onClick,
}: {
  readonly name: string;
  readonly onClick?: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-2 text-left font-medium text-foreground"
  >
    <Avatar fallback={initials(name)} className="size-7 shrink-0 text-xs" />
    <span className={onClick ? 'hover:underline' : undefined}>{name}</span>
  </button>
);

/** Org size cell — a muted people glyph + the member count (dash if unknown). */
export const MemberCount = ({ n }: { readonly n?: number | undefined }) =>
  n === undefined ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <Users className="size-3.5 text-muted-foreground" />
      {n}
    </span>
  );

/** The org's subscription tier — a quiet outlined tag (dash if none). Neutral,
 *  not state-coloured, so it reads as a category next to the coloured Status. */
export const PlanTag = ({ name }: { readonly name?: string | undefined }) =>
  name === undefined ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    <Badge variant="outline" className="whitespace-nowrap">
      {name}
    </Badge>
  );

/** Payment health: Current (green) / 1 overdue (amber) / 2+ overdue (red). */
const PAYMENT: Record<
  'current' | 'one' | 'many',
  {
    readonly variant: 'success' | 'warning' | 'destructive';
    readonly label: string;
  }
> = {
  current: { variant: 'success', label: 'Current' },
  one: { variant: 'warning', label: '1 overdue' },
  many: { variant: 'destructive', label: '2+ overdue' },
};

const paymentLevel = (n = 0): 'current' | 'one' | 'many' => {
  if (n <= 0) return 'current';
  if (n === 1) return 'one';
  return 'many';
};

const PaymentTag = ({
  overdue,
  dormant,
  pendingDeletion,
}: {
  readonly overdue?: number | undefined;
  readonly dormant?: boolean | undefined;
  readonly pendingDeletion?: boolean | undefined;
}) => {
  if (pendingDeletion)
    return (
      <Badge variant="destructive" appearance="soft" dot>
        Pending deletion
      </Badge>
    );
  if (dormant)
    return (
      <Badge variant="secondary" appearance="soft" dot>
        Dormant
      </Badge>
    );
  const p = PAYMENT[paymentLevel(overdue)];
  return (
    <Badge variant={p.variant} appearance="soft" dot>
      {p.label}
    </Badge>
  );
};

/** "Payment" column — billing health at a glance (Current / N overdue / Dormant). */
export const paymentColumn: ColumnDef<CustomerRow> = {
  id: 'payment',
  header: 'Payment',
  cell: ({ row }) => (
    <PaymentTag
      overdue={row.original.overduePayments}
      dormant={row.original.dormant}
      pendingDeletion={Boolean(row.original.pendingDeletionUntil)}
    />
  ),
};

// staffColumns lives in ./staff; invitationColumns + orphanColumns in ./lists.
