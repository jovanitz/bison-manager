import { useState, type ReactNode } from 'react';
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { Input } from '../input/input';
import { DataTableGrid, DataTablePagination } from './data-table.parts';

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
};

/**
 * Generic data table over TanStack Table + the shared Table primitives:
 * click-to-sort headers, a global search box, a rows-per-page selector, and a
 * bounded body that scrolls (sticky header) while the footer/pagination stay
 * visible. Pass `columns` + `data`; state is local view state.
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder,
  pageSize = 10,
  pageSizeOptions = [10, 20, 50],
  maxHeight = '60vh',
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
  // Guarantee the active pageSize is always a selectable option.
  const options = [...new Set([...pageSizeOptions, pageSize])].sort(
    (a, b) => a - b,
  );
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
      <div className="rounded-md border border-border">
        <div
          className="overflow-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-background"
          style={{ maxHeight }}
        >
          <DataTableGrid table={table} colSpan={columns.length} empty={empty} />
        </div>
        <DataTablePagination table={table} pageSizeOptions={options} />
      </div>
    </div>
  );
}
