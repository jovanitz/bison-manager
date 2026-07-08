import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Table as TanstackTable } from '@tanstack/react-table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../select/select';
import { Button } from '../button/button';

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
