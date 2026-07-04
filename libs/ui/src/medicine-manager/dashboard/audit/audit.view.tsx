/**
 * Medicine Manager · Dashboard · Audit trail — read-only security event log
 * (re-skin of the implemented audit-section).
 *
 * @screen Medicine Manager / Dashboard / Audit
 * @phase draft
 */
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '../../../design-system/badge/badge';
import { DataTable } from '../../../design-system/data-table/data-table';
import { EmptyState } from '../../../design-system/empty/empty-state';

export type AuditRow = {
  readonly id: string;
  readonly type: string;
  /** Who triggered the event (display name / email); system events have none. */
  readonly actor?: string;
  readonly occurredAt: string;
};
export type AuditVM = { readonly entries: readonly AuditRow[] };

const columns: ColumnDef<AuditRow>[] = [
  {
    accessorKey: 'type',
    header: 'Event',
    enableSorting: false,
    cell: ({ row }) => (
      <Badge variant="secondary" className="font-mono">
        {row.original.type}
      </Badge>
    ),
  },
  {
    id: 'by',
    header: 'By',
    accessorFn: (r) => r.actor ?? 'System',
  },
  {
    accessorKey: 'occurredAt',
    header: 'When',
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.occurredAt}</span>
    ),
  },
];

export const AuditView = ({ vm }: { readonly vm: AuditVM }) => (
  <div className="flex flex-col gap-3">
    <div>
      <h1 className="text-xl font-semibold text-foreground">Audit trail</h1>
      <p className="text-sm text-muted-foreground">
        Append-only record of sensitive security events (most recent first).
      </p>
    </div>
    {vm.entries.length === 0 ? (
      <EmptyState
        title="No events yet"
        description="Security events will show up here."
      />
    ) : (
      <DataTable columns={columns} data={vm.entries} />
    )}
  </div>
);
