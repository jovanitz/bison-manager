import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '../../../design-system/button/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../design-system/card/card';
import { DataTable } from '../../../design-system/data-table/data-table';
import type { SessionRow } from './permissions.types';

const sessionColumns = (
  onRevoke: (sessionId: string) => void,
): ColumnDef<SessionRow>[] => [
  {
    accessorKey: 'id',
    header: 'Session',
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.id}</span>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.createdAt}</span>
    ),
  },
  {
    id: 'action',
    header: () => <div className="text-right">Action</div>,
    enableSorting: false,
    cell: ({ row }) => (
      <div className="text-right">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onRevoke(row.original.id)}
        >
          Revoke
        </Button>
      </div>
    ),
  },
];

export const SessionsPanel = ({
  sessions,
  onRevoke,
  onRevokeAll,
}: {
  readonly sessions: readonly SessionRow[];
  readonly onRevoke: (sessionId: string) => void;
  readonly onRevokeAll: () => void;
}) => (
  <Card>
    <CardHeader className="flex-row items-center justify-between space-y-0">
      <CardTitle className="text-base">Sessions</CardTitle>
      {sessions.length ? (
        <Button size="sm" variant="ghost" onClick={onRevokeAll}>
          Revoke all
        </Button>
      ) : null}
    </CardHeader>
    <CardContent>
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active sessions.</p>
      ) : (
        <DataTable columns={sessionColumns(onRevoke)} data={sessions} />
      )}
    </CardContent>
  </Card>
);
