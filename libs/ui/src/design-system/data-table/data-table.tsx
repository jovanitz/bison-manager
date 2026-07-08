import { useState, type ReactNode } from 'react';
import {
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type Table as TanstackTable,
} from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { Input } from '../input/input';
import { Button } from '../button/button';
import { DataTableGrid } from './data-table.parts';
import { DataTablePagination } from './data-table.pagination';

const SearchBox = ({
  value,
  onChange,
  placeholder,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly placeholder: string;
}) => (
  <div className="relative max-w-xs">
    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="pl-8"
    />
  </div>
);

/** Bulk-actions bar — renders while rows are selected: count + actions + Clear. */
const BulkToolbar = <TData,>({
  table,
  render,
}: {
  readonly table: TanstackTable<TData>;
  readonly render: (selected: readonly TData[], clear: () => void) => ReactNode;
}) => {
  const selected = table.getSelectedRowModel().rows;
  if (selected.length === 0) return null;
  const clear = () => table.resetRowSelection();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
      <span className="text-sm font-medium text-foreground">
        {selected.length} selected
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {render(
          selected.map((r) => r.original),
          clear,
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={clear}
        className="ml-auto text-muted-foreground"
      >
        Clear
      </Button>
    </div>
  );
};

export type DataTableProps<TData, TValue> = {
  readonly columns: ColumnDef<TData, TValue>[];
  readonly data: readonly TData[];
  /** Show a global search box with this placeholder (omit to hide). */
  readonly searchPlaceholder?: string;
  readonly pageSize?: number;
  /** Rows-per-page choices in the footer selector. */
  readonly pageSizeOptions?: readonly number[];
  /** Max height of the scrolling body (rows scroll; header + footer stay). */
  readonly maxHeight?: string;
  /** Shown when there are no (filtered) rows. */
  readonly empty?: ReactNode;
  /** When set, each row gets an expander that reveals this collapsed detail. */
  readonly renderExpanded?: ((row: TData) => ReactNode) | undefined;
  /** Enable per-row checkboxes + a bulk-actions toolbar (see renderBulkActions). */
  readonly enableSelection?: boolean;
  /** Toolbar shown while rows are selected — gets the selected rows + a clear fn. */
  readonly renderBulkActions?:
    | ((selected: readonly TData[], clear: () => void) => ReactNode)
    | undefined;
};

/**
 * Generic data table over TanStack Table + the shared Table primitives:
 * click-to-sort headers, a global search box, a rows-per-page selector, a
 * bounded scrolling body (sticky header), and optional per-row expansion
 * (`renderExpanded`) to tuck secondary columns behind a click. State is local.
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder,
  pageSize = 10,
  pageSizeOptions = [10, 20, 50],
  maxHeight = '60vh',
  empty = 'No results.',
  renderExpanded,
  enableSelection = false,
  renderBulkActions,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const table = useReactTable({
    data: data as TData[],
    columns,
    state: { sorting, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: enableSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => renderExpanded !== undefined,
    initialState: { pagination: { pageSize } },
  });
  const options = [...new Set([...pageSizeOptions, pageSize])].sort(
    (a, b) => a - b,
  );
  return (
    <div className="space-y-3">
      {searchPlaceholder ? (
        <SearchBox
          value={globalFilter}
          onChange={setGlobalFilter}
          placeholder={searchPlaceholder}
        />
      ) : null}
      {renderBulkActions ? (
        <BulkToolbar table={table} render={renderBulkActions} />
      ) : null}
      <div className="rounded-md border border-border">
        <div
          className="overflow-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-background"
          style={{ maxHeight }}
        >
          <DataTableGrid
            table={table}
            colSpan={columns.length}
            empty={empty}
            renderExpanded={renderExpanded}
            selectable={enableSelection}
          />
        </div>
        <DataTablePagination table={table} pageSizeOptions={options} />
      </div>
    </div>
  );
}
