/**
 * Organizations tab — the customers DataTable plus a client-side filter bar.
 * Facet dropdowns (Status / Plan) + "Needs attention" / Payment chips narrow the
 * rows before the table's own search/sort/pagination. Filtering is ephemeral UI
 * state (like search/sort), so it stays local — the VM contract is unchanged.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Download } from 'lucide-react';
import { Button } from '../../../../design-system/button/button';
import { DataTable } from '../../../../design-system/data-table/data-table';
import { customerColumns } from './customer-columns';
import { MemberCount, PlanTag, relativeDate } from '../directory.columns';
import type {
  CustomerRow,
  DirectoryActions,
  DirectoryVM,
} from '../directory.columns';
import { bulkActions } from './bulk-actions';
import { FilterBar } from './filter-bar';
import { HealthStrip, type HealthCounts } from './health-strip';
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
    <Field label="Created">{relativeDate(row.createdAt)}</Field>
    <Field label="Last active">{relativeDate(row.lastActiveAt)}</Field>
    <Field label="Last payment">{row.lastPaymentAt ?? '—'}</Field>
    {row.pendingDeletionUntil ? (
      <Field label="Scheduled deletion">
        <span className="text-destructive">
          {relativeDate(row.pendingDeletionUntil)}
        </span>
      </Field>
    ) : null}
  </dl>
);

/** Right-aligned toolbar above the table — a count + Export of the current view. */
const OrgTableToolbar = ({
  count,
  onExport,
}: {
  readonly count: number;
  readonly onExport: () => void;
}) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-sm text-muted-foreground">
      {count} organization{count === 1 ? '' : 's'}
    </span>
    <Button variant="outline" size="sm" onClick={onExport}>
      <Download /> Export
    </Button>
  </div>
);

/** Filter state + the derived counts/plans/rows — kept in a hook so the panel
 *  component stays a thin composition (under the size cap). */
const useOrgFilterState = (customers: readonly CustomerRow[]) => {
  const [filters, setFilters] = useState<OrgFilters>(emptyFilters);
  const counts = useMemo(
    () => ({
      attention: customers.filter(flagged).length,
      dormant: customers.filter((c) => c.dormant).length,
      pendingDeletion: customers.filter((c) => c.pendingDeletionUntil).length,
    }),
    [customers],
  );
  const health = useMemo(
    (): HealthCounts => ({
      active: customers.filter((c) => c.phase === 'active').length,
      grace: customers.filter((c) => c.phase === 'grace').length,
      suspended: customers.filter((c) => c.phase === 'suspended').length,
      dormant: customers.filter((c) => c.dormant).length,
      attention: customers.filter(flagged).length,
    }),
    [customers],
  );
  const plans = useMemo(
    () => [
      ...new Set(customers.map((c) => c.plan).filter((p): p is string => !!p)),
    ],
    [customers],
  );
  const rows = useMemo(
    () => customers.filter((c) => matchesFilters(c, filters)),
    [customers, filters],
  );
  return { filters, setFilters, counts, health, plans, rows };
};

export const OrganizationsPanel = ({
  vm,
  onBlock,
  onAdmin,
  onOpenOrg,
  onScheduleDeletion,
  onCancelDeletion,
  onExportOrg,
  onExportDirectory,
}: { readonly vm: DirectoryVM } & Pick<
  DirectoryActions,
  | 'onBlock'
  | 'onAdmin'
  | 'onOpenOrg'
  | 'onScheduleDeletion'
  | 'onCancelDeletion'
  | 'onExportOrg'
  | 'onExportDirectory'
>) => {
  const { filters, setFilters, counts, health, plans, rows } =
    useOrgFilterState(vm.customers);
  return (
    <div className="flex flex-col gap-4">
      <HealthStrip counts={health} filters={filters} setFilters={setFilters} />
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        plans={plans}
        attentionCount={counts.attention}
        dormantCount={counts.dormant}
        pendingDeletionCount={counts.pendingDeletion}
      />
      <OrgTableToolbar
        count={rows.length}
        onExport={() => onExportDirectory(rows.map((r) => r.accountId))}
      />
      <DataTable
        columns={customerColumns({
          canBlock: vm.canBlock,
          canAdminAccounts: vm.canAdminAccounts,
          onBlock,
          onAdmin,
          onOpenOrg,
          onScheduleDeletion,
          onCancelDeletion,
          onExportOrg,
        })}
        data={rows}
        searchPlaceholder="Search organizations…"
        renderExpanded={(row) => (
          <OrgRowDetails row={row} onOpenOrg={onOpenOrg} />
        )}
        enableSelection
        renderBulkActions={bulkActions({
          canBlock: vm.canBlock,
          canAdminAccounts: vm.canAdminAccounts,
          onBlock,
          onAdmin,
          onExportDirectory,
        })}
        empty={
          filtersActive(filters)
            ? 'No organizations match these filters.'
            : 'No organizations yet.'
        }
      />
    </div>
  );
};
