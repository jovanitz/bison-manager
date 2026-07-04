import type { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import { Badge, type BadgeProps } from '../../../design-system/badge/badge';
import { Button } from '../../../design-system/button/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../design-system/dropdown-menu/dropdown-menu';
import type {
  PlanPrice,
  PlanRow,
  PlanStatus,
  PlansActions,
} from './plans.types';

const statusVariant: Record<PlanStatus, BadgeProps['variant']> = {
  active: 'success',
  retired: 'secondary',
};

/** "$499 MXN/mo" — cents in the VM, formatted at render. */
const formatPrice = ({ amountCents, currency, interval }: PlanPrice) => {
  const amount = amountCents / 100;
  const digits = Number.isInteger(amount) ? 0 : 2;
  return `$${amount.toFixed(digits)} ${currency}/${interval === 'year' ? 'yr' : 'mo'}`;
};

/** null = unlimited (ADR-0016). */
const limit = (n: number | null) => (n === null ? '∞' : String(n));

const PlanCell = ({ plan }: { readonly plan: PlanRow }) => (
  <div className="flex flex-col">
    <span className="flex items-center gap-2 font-medium">
      {plan.displayName}
      {plan.visibility === 'hidden' ? (
        <Badge variant="secondary" appearance="soft">
          Hidden
        </Badge>
      ) : null}
      {plan.isDefault ? (
        <Badge variant="secondary" appearance="soft">
          Default
        </Badge>
      ) : null}
    </span>
    <span className="font-mono text-xs text-muted-foreground">{plan.key}</span>
  </div>
);

const PlanActions = ({
  planId,
  onEdit,
  onReset,
  onRetire,
}: { readonly planId: string } & Pick<
  PlansActions,
  'onEdit' | 'onReset' | 'onRetire'
>) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" aria-label="Plan actions">
        <MoreHorizontal />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onSelect={() => onEdit(planId)}>
        Edit plan
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onReset(planId)}>
        Reset to defaults
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={() => onRetire(planId)}
        className="text-destructive focus:text-destructive"
      >
        Retire plan
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

const baseColumns: ColumnDef<PlanRow>[] = [
  {
    accessorKey: 'displayName',
    header: 'Plan',
    cell: ({ row }) => <PlanCell plan={row.original} />,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={statusVariant[row.original.status]} appearance="soft" dot>
        {row.original.status}
      </Badge>
    ),
  },
  {
    id: 'price',
    header: 'Price',
    cell: ({ row }) =>
      row.original.price ? (
        <span className="whitespace-nowrap">
          {formatPrice(row.original.price)}
        </span>
      ) : (
        <span className="text-muted-foreground">No price yet</span>
      ),
  },
  {
    accessorKey: 'trialMonths',
    header: 'Trial',
    cell: ({ row }) =>
      row.original.trialMonths > 0 ? `${row.original.trialMonths} mo` : '—',
  },
  {
    id: 'limits',
    header: 'Limits',
    enableSorting: false,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground">
        {limit(row.original.maxOrganizationsOwned)} org ·{' '}
        {limit(row.original.maxMembersPerOrg)} seats
      </span>
    ),
  },
  {
    id: 'features',
    header: 'Features',
    cell: ({ row }) => row.original.features.length,
  },
  { accessorKey: 'subscribers', header: 'Subscribers' },
];

export const planColumns = ({
  canManage,
  onEdit,
  onReset,
  onRetire,
}: { readonly canManage: boolean } & Pick<
  PlansActions,
  'onEdit' | 'onReset' | 'onRetire'
>): ColumnDef<PlanRow>[] => {
  if (!canManage) return baseColumns;
  return [
    ...baseColumns,
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="text-right">
          <PlanActions
            planId={row.original.planId}
            onEdit={onEdit}
            onReset={onReset}
            onRetire={onRetire}
          />
        </div>
      ),
    },
  ];
};
