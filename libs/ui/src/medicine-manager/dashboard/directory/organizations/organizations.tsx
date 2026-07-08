/**
 * Organizations tab — the customers DataTable plus a client-side filter bar.
 * Facet dropdowns (Status / Plan) + "Needs attention" / Payment chips narrow the
 * rows before the table's own search/sort/pagination. Filtering is ephemeral UI
 * state (like search/sort), so it stays local — the VM contract is unchanged.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { DataTable } from '../../../../design-system/data-table/data-table';
import { customerColumns } from '../directory.customer-columns';
import { MemberCount, PlanTag } from '../directory.columns';
import type {
  CustomerRow,
  DirectoryActions,
  DirectoryVM,
} from '../directory.columns';
import { FilterBar } from './filter-bar';
import {
  emptyFilters,
  filtersActive,
  flagged,
  matchesFilters,
  type OrgFilters,
} from './filters';

const Field = ({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) => (
  <div className="flex flex-col gap-0.5">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="text-sm text-foreground">{children}</dd>
  </div>
);

/** Collapsed row detail — the secondary columns tucked behind the row expander.
 *  Members stays a click target → opens the org detail (its roster), as before. */
const OrgRowDetails = ({
  row,
  onOpenOrg,
}: {
  readonly row: CustomerRow;
  readonly onOpenOrg: (accountId: string) => void;
}) => (
  <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
    <Field label="Plan">
      <PlanTag name={row.plan} />
    </Field>
    <Field label="Members">
      <button
        type="button"
        onClick={() => onOpenOrg(row.accountId)}
        aria-label="View members"
        className="w-fit rounded-sm hover:underline focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <MemberCount n={row.memberCount} />
      </button>
    </Field>
    <Field label="Email">{row.email ?? '—'}</Field>
  </dl>
);

export const OrganizationsPanel = ({
  vm,
  onBlock,
  onAdmin,
  onOpenOrg,
}: { readonly vm: DirectoryVM } & Pick<
  DirectoryActions,
  'onBlock' | 'onAdmin' | 'onOpenOrg'
>) => {
  const [filters, setFilters] = useState<OrgFilters>(emptyFilters);
  const attentionCount = useMemo(
    () => vm.customers.filter(flagged).length,
    [vm.customers],
  );
  const plans = useMemo(
    () => [
      ...new Set(
        vm.customers.map((c) => c.plan).filter((p): p is string => !!p),
      ),
    ],
    [vm.customers],
  );
  const rows = useMemo(
    () => vm.customers.filter((c) => matchesFilters(c, filters)),
    [vm.customers, filters],
  );
  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        plans={plans}
        attentionCount={attentionCount}
      />
      <DataTable
        columns={customerColumns({
          canBlock: vm.canBlock,
          canAdminAccounts: vm.canAdminAccounts,
          onBlock,
          onAdmin,
          onOpenOrg,
        })}
        data={rows}
        searchPlaceholder="Search organizations…"
        renderExpanded={(row) => (
          <OrgRowDetails row={row} onOpenOrg={onOpenOrg} />
        )}
        empty={
          filtersActive(filters)
            ? 'No organizations match these filters.'
            : 'No organizations yet.'
        }
      />
    </div>
  );
};
