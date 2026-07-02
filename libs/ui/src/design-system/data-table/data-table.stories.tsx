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

const data: Member[] = [
  {
    name: 'Ana Torres',
    email: 'ana@acme.com',
    role: 'Owner',
    status: 'active',
  },
  {
    name: 'Beto Ruiz',
    email: 'beto@acme.com',
    role: 'Admin',
    status: 'active',
  },
  {
    name: 'Cami Díaz',
    email: 'cami@acme.com',
    role: 'Member',
    status: 'invited',
  },
  {
    name: 'Dario Paz',
    email: 'dario@acme.com',
    role: 'Member',
    status: 'active',
  },
  {
    name: 'Elsa Mora',
    email: 'elsa@acme.com',
    role: 'Admin',
    status: 'blocked',
  },
  {
    name: 'Fito Vega',
    email: 'fito@acme.com',
    role: 'Member',
    status: 'active',
  },
  {
    name: 'Gaby Sol',
    email: 'gaby@acme.com',
    role: 'Member',
    status: 'invited',
  },
  {
    name: 'Hugo Lara',
    email: 'hugo@acme.com',
    role: 'Admin',
    status: 'active',
  },
  {
    name: 'Ivan Cruz',
    email: 'ivan@acme.com',
    role: 'Member',
    status: 'active',
  },
  {
    name: 'Julia Rey',
    email: 'julia@acme.com',
    role: 'Owner',
    status: 'active',
  },
  {
    name: 'Kilo Mata',
    email: 'kilo@acme.com',
    role: 'Member',
    status: 'blocked',
  },
  {
    name: 'Lena Ortiz',
    email: 'lena@acme.com',
    role: 'Member',
    status: 'invited',
  },
];

const columns: ColumnDef<Member>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'role', header: 'Role' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status;
      return <Badge variant={statusVariant[status]}>{status}</Badge>;
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
      pageSize={5}
    />
  ),
};
