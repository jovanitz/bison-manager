import type { ColumnDef } from '@tanstack/react-table';
import { Users } from 'lucide-react';
import { Badge } from '../../../design-system/badge/badge';

/** Local row types — decoupled from application DTOs (the container maps to these). */
export type StaffRow = {
  readonly accountId: string;
  readonly email?: string;
  readonly displayName?: string;
};
export type CustomerRow = {
  readonly accountId: string;
  readonly displayName: string;
  readonly email?: string;
  /** How many users belong to the org — its size at a glance. */
  readonly memberCount?: number;
  /** The org's current subscription plan (display name). */
  readonly plan?: string;
  /** True when the org has at least one unpaid (pending/failed) charge. */
  readonly pendingPayment?: boolean;
  /** Soft block — org access suspended, reversible (Block/Unblock org). */
  readonly blocked?: boolean;
  /** Hard disable — the whole account is off (Disable/Enable account). */
  readonly disabled?: boolean;
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
  readonly onCopyInvite: (invitationId: string) => void;
  readonly onResendInvite: (invitationId: string) => void;
  readonly onRevokeInvitation: (invitationId: string) => void;
  /** Orphaned identity (registered, no org). */
  readonly onInviteOrphan: (userId: string) => void;
  readonly onDeleteOrphan: (userId: string) => void;
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

const dash = (v?: string) => v ?? '—';

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

/** Billing attention flag — an amber "Pending" pill when a charge is unpaid. */
const PendingPaymentTag = ({
  pending,
}: {
  readonly pending?: boolean | undefined;
}) =>
  pending ? (
    <Badge variant="warning" appearance="soft" dot>
      Pending
    </Badge>
  ) : (
    <span className="text-muted-foreground">—</span>
  );

/** "Payment" column — flags orgs with an unpaid charge (amber pill). */
export const paymentColumn: ColumnDef<CustomerRow> = {
  id: 'payment',
  header: 'Payment',
  cell: ({ row }) => (
    <PendingPaymentTag pending={row.original.pendingPayment} />
  ),
};

/** The clickable "Members" column — the count opens the org's roster. */
export const membersColumn = (
  onOpenOrg: (accountId: string) => void,
): ColumnDef<CustomerRow> => ({
  id: 'members',
  header: 'Members',
  cell: ({ row }) => (
    <button
      type="button"
      onClick={() => onOpenOrg(row.original.accountId)}
      aria-label="View members"
      className="rounded-sm hover:underline focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <MemberCount n={row.original.memberCount} />
    </button>
  ),
});

/** Clickable staff rows — the name opens the member's access detail. */
export const staffColumns = (
  onOpenStaff: (accountId: string) => void,
): ColumnDef<StaffRow>[] => [
  {
    accessorKey: 'displayName',
    header: 'Name',
    cell: ({ row }) => (
      <button
        type="button"
        onClick={() => onOpenStaff(row.original.accountId)}
        className="font-medium text-foreground hover:underline"
      >
        {dash(row.original.displayName)}
      </button>
    ),
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => dash(row.original.email),
  },
  { accessorKey: 'accountId', header: 'Account' },
];

// invitationColumns + orphanColumns now live in ./lists (with ⋯ actions).
