/**
 * Confirmation gate for the consequential ⋯ actions on the Organizations table.
 * Presentational: the menu sets a `PendingAction`; this dialog renders its copy
 * and, on confirm, runs the SAME onBlock/onAdmin action — it only interposes an
 * explicit yes/no, so no new state leaves the component.
 */
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../design-system/alert-dialog/alert-dialog';

/** Which ⋯ action awaits confirmation (maps 1:1 to onBlock / onAdmin). */
export type PendingAction =
  | { readonly kind: 'block'; readonly next: boolean }
  | {
      readonly kind: 'account';
      readonly action: 'disable' | 'enable' | 'promote';
    };

type Copy = {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly destructive: boolean;
};

const copyFor = (p: PendingAction, orgName: string): Copy => {
  if (p.kind === 'block')
    return p.next
      ? {
          title: 'Block organization?',
          description: `${orgName} will lose access until you unblock it. This is reversible.`,
          confirmLabel: 'Block',
          destructive: true,
        }
      : {
          title: 'Unblock organization?',
          description: `Restore access for ${orgName}.`,
          confirmLabel: 'Unblock',
          destructive: false,
        };
  if (p.action === 'disable')
    return {
      title: 'Disable account?',
      description: `Turns off ${orgName}'s entire account across every org. Reversible.`,
      confirmLabel: 'Disable',
      destructive: true,
    };
  if (p.action === 'enable')
    return {
      title: 'Enable account?',
      description: `Turn ${orgName}'s account back on.`,
      confirmLabel: 'Enable',
      destructive: false,
    };
  return {
    title: 'Promote to staff?',
    description: `Grant ${orgName} staff-level access to the dashboard.`,
    confirmLabel: 'Promote',
    destructive: false,
  };
};

const Body = ({
  copy,
  onConfirm,
}: {
  readonly copy: Copy;
  readonly onConfirm: () => void;
}) => (
  <>
    <AlertDialogHeader>
      <AlertDialogTitle>{copy.title}</AlertDialogTitle>
      <AlertDialogDescription>{copy.description}</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction
        onClick={onConfirm}
        className={
          copy.destructive
            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            : undefined
        }
      >
        {copy.confirmLabel}
      </AlertDialogAction>
    </AlertDialogFooter>
  </>
);

export const ConfirmActionDialog = ({
  pending,
  orgName,
  onCancel,
  onConfirm,
}: {
  readonly pending: PendingAction | null;
  readonly orgName: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) => (
  <AlertDialog
    open={pending !== null}
    onOpenChange={(open) => (open ? undefined : onCancel())}
  >
    <AlertDialogContent>
      {pending ? (
        <Body copy={copyFor(pending, orgName)} onConfirm={onConfirm} />
      ) : null}
    </AlertDialogContent>
  </AlertDialog>
);
