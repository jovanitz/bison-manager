import { Fragment, type ReactNode } from 'react';
import {
  flexRender,
  type Header,
  type Row as TanstackRow,
  type Table as TanstackTable,
} from '@tanstack/react-table';
import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '../cn';
import { Checkbox } from '../checkbox/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../table/table';

const SortIcon = ({ dir }: { readonly dir: false | 'asc' | 'desc' }) => {
  if (dir === 'asc') return <ChevronUp className="size-3.5" />;
  if (dir === 'desc') return <ChevronDown className="size-3.5" />;
  return (
    <ChevronsUpDown className="size-3.5 opacity-0 transition-opacity group-hover:opacity-50" />
  );
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
      className="group inline-flex items-center gap-1 hover:text-foreground"
    >
      {label}
      <SortIcon dir={header.column.getIsSorted()} />
    </button>
  );
};

/** A data row plus, when expandable, a full-width detail row below it. */
const ExpandableRow = <TData,>({
  row,
  renderExpanded,
  totalCols,
  selectable,
}: {
  readonly row: TanstackRow<TData>;
  readonly renderExpanded?: ((row: TData) => ReactNode) | undefined;
  readonly totalCols: number;
  readonly selectable?: boolean | undefined;
}) => (
  <Fragment>
    <TableRow data-state={row.getIsSelected() ? 'selected' : undefined}>
      {selectable ? (
        <TableCell className="w-8">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Select row"
          />
        </TableCell>
      ) : null}
      {renderExpanded ? (
        <TableCell className="w-8 pr-0">
          <button
            type="button"
            onClick={() => row.toggleExpanded()}
            aria-label={row.getIsExpanded() ? 'Collapse row' : 'Expand row'}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronRight
              className={cn(
                'size-4 transition-transform',
                row.getIsExpanded() && 'rotate-90',
              )}
            />
          </button>
        </TableCell>
      ) : null}
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
    {renderExpanded && row.getIsExpanded() ? (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={totalCols} className="bg-muted/30 px-4 py-3">
          {renderExpanded(row.original)}
        </TableCell>
      </TableRow>
    ) : null}
  </Fragment>
);

/** Header + body over the shared Table, with click-to-sort + optional expansion. */
export const DataTableGrid = <TData,>({
  table,
  colSpan,
  empty,
  renderExpanded,
  selectable,
}: {
  readonly table: TanstackTable<TData>;
  readonly colSpan: number;
  readonly empty: ReactNode;
  /** When set, each row gets an expander that reveals this detail content. */
  readonly renderExpanded?: ((row: TData) => ReactNode) | undefined;
  /** Leading checkbox column for row selection. */
  readonly selectable?: boolean | undefined;
}) => {
  const totalCols = colSpan + (renderExpanded ? 1 : 0) + (selectable ? 1 : 0);
  return (
    <Table containerClassName="overflow-visible">
      <TableHeader>
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id}>
            {selectable ? (
              <TableHead className="w-8">
                <Checkbox
                  checked={table.getIsAllPageRowsSelected()}
                  onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
                  aria-label="Select all"
                />
              </TableHead>
            ) : null}
            {renderExpanded ? <TableHead className="w-8" /> : null}
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
          table
            .getRowModel()
            .rows.map((row) => (
              <ExpandableRow
                key={row.id}
                row={row}
                renderExpanded={renderExpanded}
                totalCols={totalCols}
                selectable={selectable}
              />
            ))
        ) : (
          <TableRow>
            <TableCell
              colSpan={totalCols}
              className="h-24 text-center text-muted-foreground"
            >
              {empty}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
};
