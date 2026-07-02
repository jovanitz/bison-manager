import { useState, type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Header,
  type SortingState,
  type Table as TanstackTable,
} from '@tanstack/react-table';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  Search,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../table/table';
import { Input } from '../input/input';
import { Button } from '../button/button';

export type DataTableProps<TData, TValue> = {
  readonly columns: ColumnDef<TData, TValue>[];
  readonly data: readonly TData[];
  /** Show a global search box with this placeholder (omit to hide). */
  readonly searchPlaceholder?: string;
  readonly pageSize?: number;
  /** Shown when there are no (filtered) rows. */
  readonly empty?: ReactNode;
};

const SortIcon = ({ dir }: { readonly dir: false | 'asc' | 'desc' }) => {
  if (dir === 'asc') return <ChevronUp className="size-3.5" />;
  if (dir === 'desc') return <ChevronDown className="size-3.5" />;
  return <ChevronsUpDown className="size-3.5 opacity-50" />;
};

/** A header cell — a click-to-sort button when the column is sortable. */
const HeaderCell = <TData,>({
  header,
}: {
  readonly header: Header<TData, unknown>;
}) => {
  if (header.isPlaceholder) return null;
  const label = flexRender(header.column.columnDef.header, header.getContext());
  if (!header.column.getCanSort()) return <>{label}</>;
  return (
    <button
      type="button"
      onClick={header.column.getToggleSortingHandler()}
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      {label}
      <SortIcon dir={header.column.getIsSorted()} />
    </button>
  );
};

/** Header + body over the shared Table, with click-to-sort headers. */
const DataTableGrid = <TData,>({
  table,
  colSpan,
  empty,
}: {
  readonly table: TanstackTable<TData>;
  readonly colSpan: number;
  readonly empty: ReactNode;
}) => (
  <Table>
    <TableHeader>
      {table.getHeaderGroups().map((hg) => (
        <TableRow key={hg.id}>
          {hg.headers.map((header) => (
            <TableHead key={header.id}>
              <HeaderCell header={header} />
            </TableHead>
          ))}
        </TableRow>
      ))}
    </TableHeader>
    <TableBody>
      {table.getRowModel().rows.length ? (
        table.getRowModel().rows.map((row) => (
          <TableRow key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))
      ) : (
        <TableRow>
          <TableCell
            colSpan={colSpan}
            className="h-24 text-center text-muted-foreground"
          >
            {empty}
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  </Table>
);

const DataTablePagination = <TData,>({
  table,
}: {
  readonly table: TanstackTable<TData>;
}) => (
  <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
    <span>{table.getFilteredRowModel().rows.length} row(s)</span>
    <div className="flex items-center gap-2">
      <span>
        Page {table.getState().pagination.pageIndex + 1} of{' '}
        {table.getPageCount() || 1}
      </span>
      <Button
        variant="outline"
        size="icon"
        onClick={() => table.previousPage()}
        disabled={!table.getCanPreviousPage()}
        aria-label="Previous page"
      >
        <ChevronLeft />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={() => table.nextPage()}
        disabled={!table.getCanNextPage()}
        aria-label="Next page"
      >
        <ChevronRight />
      </Button>
    </div>
  </div>
);

/**
 * Generic data table over TanStack Table + the shared Table primitives:
 * click-to-sort headers, a global search box and client-side pagination. Pass
 * `columns` (ColumnDef[]) and `data`; state is local view state.
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder,
  pageSize = 10,
  empty = 'No results.',
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const table = useReactTable({
    data: data as TData[],
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });
  return (
    <div className="space-y-3">
      {searchPlaceholder ? (
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8"
          />
        </div>
      ) : null}
      <div className="overflow-hidden rounded-md border border-border">
        <DataTableGrid table={table} colSpan={columns.length} empty={empty} />
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
