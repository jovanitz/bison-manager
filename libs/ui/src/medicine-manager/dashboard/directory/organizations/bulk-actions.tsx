/**
 * Bulk-actions toolbar for the Organizations table — shown by the DataTable
 * while rows are selected. Beyond Block it offers Disable (behind admin rights)
 * and Export selected; the destructive picks stage a confirmation summarizing
 * the count before firing. Presentational: it just dispatches the row actions.
 */
import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '../../../../design-system/button/button';
import { ConfirmDialog, type Copy } from '../directory.confirm';
import type { CustomerRow, DirectoryActions } from '../directory.columns';

type BulkMod = Pick<
  DirectoryActions,
  'onBlock' | 'onAdmin' | 'onExportDirectory'
>;

const plural = (n: number) => (n === 1 ? '' : 's');

const bulkCopy = (kind: 'block' | 'disable', n: number): Copy =>
  kind === 'block'
    ? {
        title: `Block ${n} organization${plural(n)}?`,
        description: 'They lose access until you unblock them. Reversible.',
        confirmLabel: 'Block',
        destructive: true,
      }
    : {
        title: `Disable ${n} account${plural(n)}?`,
        description: 'Turns off each account across every org. Reversible.',
        confirmLabel: 'Disable',
        destructive: true,
      };

const BulkBar = ({
  selected,
  clear,
  canBlock,
  canAdminAccounts,
  onBlock,
  onAdmin,
  onExportDirectory,
}: {
  readonly selected: readonly CustomerRow[];
  readonly clear: () => void;
  readonly canBlock: boolean;
  readonly canAdminAccounts: boolean;
} & BulkMod) => {
  const [pending, setPending] = useState<'block' | 'disable' | null>(null);
  const ids = selected.map((r) => r.accountId);
  const run = () => {
    if (pending === 'block') ids.forEach((id) => onBlock(id, true));
    if (pending === 'disable') ids.forEach((id) => onAdmin(id, 'disable'));
    clear();
    setPending(null);
  };
  return (
    <>
      {canBlock ? (
        <Button variant="outline" size="sm" onClick={() => setPending('block')}>
          Block
        </Button>
      ) : null}
      {canAdminAccounts ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPending('disable')}
        >
          Disable
        </Button>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          onExportDirectory(ids);
          clear();
        }}
      >
        <Download /> Export
      </Button>
      <ConfirmDialog
        open={pending !== null}
        copy={pending ? bulkCopy(pending, selected.length) : null}
        onOpenChange={(o) => (o ? undefined : setPending(null))}
        onConfirm={run}
      />
    </>
  );
};

/** DataTable `renderBulkActions` factory — closes over the row actions + rights. */
export const bulkActions =
  ({
    canBlock,
    canAdminAccounts,
    onBlock,
    onAdmin,
    onExportDirectory,
  }: {
    readonly canBlock: boolean;
    readonly canAdminAccounts: boolean;
  } & BulkMod) =>
  (selected: readonly CustomerRow[], clear: () => void) => (
    <BulkBar
      selected={selected}
      clear={clear}
      canBlock={canBlock}
      canAdminAccounts={canAdminAccounts}
      onBlock={onBlock}
      onAdmin={onAdmin}
      onExportDirectory={onExportDirectory}
    />
  );
