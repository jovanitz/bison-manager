/**
 * Medicine Manager · Dashboard · Audit trail — read-only, append-only record of
 * sensitive events (moderation, billing, invites, roles, sessions). Each row
 * reads as a toned event + the entity it touched (Target), which links back to
 * that org/staff. A category chip bar + the table search narrow the log.
 *
 * @screen Medicine Manager / Dashboard / Audit
 * @phase draft
 */
import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge, type BadgeProps } from '../../../design-system/badge/badge';
import { Toggle } from '../../../design-system/toggle/toggle';
import { DataTable } from '../../../design-system/data-table/data-table';
import { EmptyState } from '../../../design-system/empty/empty-state';

export type AuditCategory =
  | 'access'
  | 'billing'
  | 'invites'
  | 'roles'
  | 'sessions';

export type AuditTarget = {
  readonly label: string;
  readonly kind: 'org' | 'staff' | 'identity';
  readonly id?: string;
};

export type AuditRow = {
  readonly id: string;
  /** Machine event code, e.g. `account.blocked` — the append-only truth. */
  readonly type: string;
  readonly category: AuditCategory;
  /** Who triggered the event (display name / email); system events have none. */
  readonly actor?: string;
  /** The entity the event acted on — links back to its detail. */
  readonly target?: AuditTarget;
  readonly occurredAt: string;
};
export type AuditVM = { readonly entries: readonly AuditRow[] };
export type AuditActions = { readonly onOpenTarget?: (row: AuditRow) => void };

const EVENT_LABEL: Record<string, string> = {
  'org.blocked': 'Organization blocked',
  'org.unblocked': 'Organization unblocked',
  'account.disabled': 'Account disabled',
  'account.enabled': 'Account enabled',
  'account.promoted': 'Promoted to staff',
  'staff.demoted': 'Demoted from staff',
  'org.deletion_scheduled': 'Deletion scheduled',
  'org.deletion_canceled': 'Deletion canceled',
  'invite.sent': 'Invitation sent',
  'invite.revoked': 'Invitation revoked',
  'payment.recorded': 'Payment recorded',
  'payment.voided': 'Payment voided',
  'payment.refunded': 'Payment refunded',
  'role.assigned': 'Role assigned',
  'session.revoked': 'Session revoked',
};
const labelOf = (t: string) => EVENT_LABEL[t] ?? t;

const NEGATIVE = [
  'blocked',
  'disabled',
  'deletion_scheduled',
  'revoked',
  'voided',
  'refunded',
  'demoted',
];
const POSITIVE = ['unblocked', 'enabled', 'deletion_canceled', 'recorded'];
const toneOf = (t: string): BadgeProps['variant'] => {
  if (NEGATIVE.some((k) => t.includes(k))) return 'destructive';
  if (POSITIVE.some((k) => t.includes(k))) return 'success';
  return 'secondary';
};

const EventCell = ({ row }: { readonly row: AuditRow }) => (
  <div className="flex flex-col gap-0.5">
    <Badge variant={toneOf(row.type)} appearance="soft" dot className="w-fit">
      {labelOf(row.type)}
    </Badge>
    <span className="font-mono text-[0.6875rem] text-muted-foreground">
      {row.type}
    </span>
  </div>
);

const TargetCell = ({
  row,
  onOpen,
}: {
  readonly row: AuditRow;
  readonly onOpen?: ((r: AuditRow) => void) | undefined;
}) => {
  const t = row.target;
  if (!t) return <span className="text-muted-foreground">—</span>;
  const body = (
    <>
      {t.label}{' '}
      <span className="text-xs text-muted-foreground">· {t.kind}</span>
    </>
  );
  if (!onOpen) return <span>{body}</span>;
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className="rounded-sm text-left hover:underline focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {body}
    </button>
  );
};

const auditColumns = (
  onOpenTarget?: (row: AuditRow) => void,
): ColumnDef<AuditRow>[] => [
  {
    accessorKey: 'type',
    header: 'Event',
    enableSorting: false,
    cell: ({ row }) => <EventCell row={row.original} />,
  },
  {
    id: 'target',
    header: 'Target',
    accessorFn: (r) => r.target?.label ?? '',
    cell: ({ row }) => <TargetCell row={row.original} onOpen={onOpenTarget} />,
  },
  { id: 'by', header: 'By', accessorFn: (r) => r.actor ?? 'System' },
  {
    accessorKey: 'occurredAt',
    header: 'When',
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.occurredAt}</span>
    ),
  },
];

const CATEGORIES: readonly {
  readonly key: AuditCategory;
  readonly label: string;
}[] = [
  { key: 'access', label: 'Access' },
  { key: 'billing', label: 'Billing' },
  { key: 'invites', label: 'Invites' },
  { key: 'roles', label: 'Roles' },
  { key: 'sessions', label: 'Sessions' },
];
const CHIP =
  'h-7 shrink-0 rounded-full px-3 text-xs data-[state=on]:border-primary/40 data-[state=on]:bg-primary/10 data-[state=on]:text-foreground';

const CategoryBar = ({
  active,
  setActive,
  available,
}: {
  readonly active: AuditCategory | null;
  readonly setActive: (c: AuditCategory | null) => void;
  readonly available: ReadonlySet<AuditCategory>;
}) => (
  <div className="flex flex-wrap items-center gap-2">
    {CATEGORIES.filter((c) => available.has(c.key)).map((c) => (
      <Toggle
        key={c.key}
        size="sm"
        variant="outline"
        pressed={active === c.key}
        onPressedChange={(on) => setActive(on ? c.key : null)}
        className={CHIP}
      >
        {c.label}
      </Toggle>
    ))}
  </div>
);

export const AuditView = ({
  vm,
  onOpenTarget,
}: { readonly vm: AuditVM } & AuditActions) => {
  const [active, setActive] = useState<AuditCategory | null>(null);
  const available = useMemo(
    () => new Set(vm.entries.map((e) => e.category)),
    [vm.entries],
  );
  const rows = useMemo(
    () =>
      active ? vm.entries.filter((e) => e.category === active) : vm.entries,
    [vm.entries, active],
  );
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Audit trail</h1>
        <p className="text-sm text-muted-foreground">
          Append-only record of sensitive events (most recent first).
        </p>
      </div>
      {vm.entries.length === 0 ? (
        <EmptyState
          title="No events yet"
          description="Security events will show up here."
        />
      ) : (
        <>
          <CategoryBar
            active={active}
            setActive={setActive}
            available={available}
          />
          <DataTable
            columns={auditColumns(onOpenTarget)}
            data={rows}
            searchPlaceholder="Search events…"
          />
        </>
      )}
    </div>
  );
};
