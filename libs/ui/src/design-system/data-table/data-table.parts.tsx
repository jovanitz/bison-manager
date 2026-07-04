import type { ReactNode } from 'react';
import {
  flexRender,
  type Header,
  type Table as TanstackTable,
} from '@tanstack/react-table';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../table/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../select/select';
import { Button } from '../button/button';

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
export const DataTableGrid = <TData,>({
  table,
  colSpan,
  empty,
}: {
  readonly table: TanstackTable<TData>;
  readonly colSpan: number;
  readonly empty: ReactNode;
}) => (
  <Table containerClassName="overflow-visible">
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

/** Always-visible footer: row count + rows-per-page selector + page nav. */
export const DataTablePagination = <TData,>({
  table,
  pageSizeOptions,
}: {
  readonly table: TanstackTable<TData>;
  readonly pageSizeOptions: readonly number[];
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2 text-sm text-muted-foreground">
    <span className="tabular-nums">
      {table.getFilteredRowModel().rows.length} row(s)
    </span>
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline">Rows per page</span>
        <Select
          value={String(table.getState().pagination.pageSize)}
          onValueChange={(v) => table.setPageSize(Number(v))}
        >
          <SelectTrigger className="h-8 w-[4.5rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <span className="tabular-nums">
        Page {table.getState().pagination.pageIndex + 1} of{' '}
        {table.getPageCount() || 1}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          aria-label="Previous page"
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          aria-label="Next page"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  </div>
);
