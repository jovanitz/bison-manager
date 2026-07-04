import type { Meta, StoryObj } from '@storybook/react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from './data-table';
import { Badge, type BadgeProps } from '../badge/badge';

type Member = {
  name: string;
  email: string;
  role: 'Owner' | 'Admin' | 'Member';
  status: 'active' | 'invited' | 'blocked';
};

const statusVariant: Record<Member['status'], BadgeProps['variant']> = {
  active: 'success',
  invited: 'warning',
  blocked: 'destructive',
};

const roles = ['Owner', 'Admin', 'Member'] as const;
const statuses = ['active', 'invited', 'blocked'] as const;

// 28 rows so a full page (10) exceeds the body height → the body scrolls while
// the sticky header + pagination stay put.
const data: Member[] = Array.from({ length: 28 }, (_, i) => ({
  name: `Member ${String(i + 1).padStart(2, '0')}`,
  email: `member${i + 1}@acme.com`,
  role: roles[i % roles.length],
  status: statuses[i % statuses.length],
}));

const columns: ColumnDef<Member>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'role', header: 'Role' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status;
      return (
        <Badge variant={statusVariant[status]} appearance="soft" dot>
          {status}
        </Badge>
      );
    },
  },
];

const meta: Meta<typeof DataTable> = {
  title: 'Design System/Data Table',
  component: DataTable,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<typeof DataTable<Member, unknown>>;

/** Members directory: click a header to sort, type to filter, paginate below. */
export const Members: Story = {
  render: () => (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search members…"
      pageSize={10}
      maxHeight="20rem"
    />
  ),
};
