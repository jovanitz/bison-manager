import type { CustomerRow } from '../directory.columns';

/**
 * Client-side CSV export of the Organizations view. Pure serialization here
 * (fully testable); `downloadCsv` is the only browser side-effect. There is no
 * backend — the directory read-model already lives in the VM, so exporting is
 * just a projection of the rows the user is looking at.
 *
 * The Status column is derived HONESTLY from state that actually exists (block /
 * disable / dormant / pending-deletion / billing phase). It never invents an
 * "N overdue" count — the ledger has no per-charge data wired yet.
 */
type CsvColumn = {
  readonly header: string;
  readonly value: (row: CustomerRow) => string;
};

/** RFC 4180: quote a field iff it holds a comma, quote or newline; double quotes. */
const escapeCsv = (field: string): string =>
  /[",\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;

const yesNo = (flag?: boolean): string => (flag ? 'yes' : 'no');

const orgStatus = (row: CustomerRow): string => {
  if (row.pendingDeletionUntil) return 'pending-deletion';
  if (row.dormant) return 'dormant';
  if (row.disabled) return 'disabled';
  if (row.blocked) return 'blocked';
  return row.phase ?? 'unknown';
};

const CUSTOMER_COLUMNS: readonly CsvColumn[] = [
  { header: 'Organization', value: (r) => r.displayName },
  { header: 'Email', value: (r) => r.email ?? '' },
  { header: 'Members', value: (r) => (r.memberCount ?? '').toString() },
  { header: 'Plan', value: (r) => r.plan ?? '' },
  { header: 'Billing phase', value: (r) => r.phase ?? '' },
  { header: 'Status', value: orgStatus },
  { header: 'Blocked', value: (r) => yesNo(r.blocked) },
  { header: 'Disabled', value: (r) => yesNo(r.disabled) },
  { header: 'Pending deletion', value: (r) => r.pendingDeletionUntil ?? '' },
];

const toCsv = (rows: readonly CustomerRow[]): string => {
  const cells = (row: CustomerRow): string =>
    CUSTOMER_COLUMNS.map((c) => escapeCsv(c.value(row))).join(',');
  const header = CUSTOMER_COLUMNS.map((c) => escapeCsv(c.header)).join(',');
  return [header, ...rows.map(cells)].join('\r\n');
};

/** CSV for the directory: the given ids (a selection), or all when ids is empty. */
export const directoryCsv = (
  customers: readonly CustomerRow[],
  ids: readonly string[],
): string => {
  if (ids.length === 0) return toCsv(customers);
  const wanted = new Set(ids);
  return toCsv(customers.filter((c) => wanted.has(c.accountId)));
};

/** CSV for one org, or null when the account is not in the current view. */
export const orgCsv = (
  customers: readonly CustomerRow[],
  accountId: string,
): string | null => {
  const row = customers.find((c) => c.accountId === accountId);
  return row ? toCsv([row]) : null;
};

/** Browser side-effect: download `csv` as `filename`. No-op off the browser. */
export const downloadCsv = (filename: string, csv: string): void => {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};
