/**
 * Medicine Manager · Dashboard · Directory — staff, customers, invitations,
 * orphaned identities (the implemented dashboard-screen tables, re-skinned).
 *
 * @screen Medicine Manager / Dashboard / Directory
 * @phase approved
 *
 * Signed off and wired: the seam is `directory.container.tsx`, which feeds this
 * view its ViewModel (store selector) + backed actions. Presentational still —
 * a pure function of (ViewModel + actions) over the design system. Row types are
 * local (decoupled from application DTOs) so wiring maps to them. Capabilities
 * (canBlock/canAdminAccounts) are DATA on the VM.
 */
import { type ReactNode } from 'react';
import { Mail, UserRoundX } from 'lucide-react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../../design-system/tabs/tabs';
import { Badge } from '../../../design-system/badge/badge';
import { DataTable } from '../../../design-system/data-table/data-table';
import { Skeleton } from '../../../design-system/skeleton/skeleton';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '../../../design-system/alert/alert';
import type { DirectoryActions, DirectoryVM } from './directory.columns';
import { staffColumns } from './staff/staff-columns';
import { InviteDialog } from './invite/invite-dialog';
import { invitationColumns } from './lists/invitations';
import { orphanColumns } from './lists/orphans';
import { OrganizationsPanel } from './organizations/organizations';

export type { DirectoryVM };

const Count = ({ n }: { readonly n: number }) => (
  <Badge variant="secondary" className="ml-2">
    {n}
  </Badge>
);

/** A friendlier empty cell — an icon over the message (used per tab). */
const TableEmpty = ({
  icon,
  label,
}: {
  readonly icon: ReactNode;
  readonly label: string;
}) => (
  <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground">
    <div className="opacity-40">{icon}</div>
    <span className="text-sm">{label}</span>
  </div>
);

const INVITATIONS_EMPTY = (
  <TableEmpty
    icon={<Mail className="size-8" />}
    label="No pending invitations"
  />
);
const ORPHANS_EMPTY = (
  <TableEmpty
    icon={<UserRoundX className="size-8" />}
    label="No orphaned identities"
  />
);

/** Staff tab — the "+ Invite staff" CTA plus the roster with moderation ⋯. */
const StaffTab = ({
  vm,
  a,
}: {
  readonly vm: DirectoryVM;
  readonly a: DirectoryActions;
}) => (
  <TabsContent value="staff" className="flex flex-col gap-3">
    <div className="flex justify-end">
      <InviteDialog onInvite={a.onInvite} />
    </div>
    <DataTable
      columns={staffColumns({
        canBlock: vm.canBlock,
        canAdminAccounts: vm.canAdminAccounts,
        onOpenStaff: a.onOpenStaff,
        onBlockStaff: a.onBlockStaff,
        onDisableStaff: a.onDisableStaff,
        onDemoteStaff: a.onDemoteStaff,
      })}
      data={vm.staff}
      searchPlaceholder="Search staff…"
    />
  </TabsContent>
);

/** Invitations tab — pending invites + the same "+ Invite" CTA (staff-only). */
const InvitationsTab = ({
  vm,
  a,
}: {
  readonly vm: DirectoryVM;
  readonly a: DirectoryActions;
}) => (
  <TabsContent value="invitations" className="flex flex-col gap-3">
    <div className="flex justify-end">
      <InviteDialog onInvite={a.onInvite} />
    </div>
    <DataTable
      columns={invitationColumns({
        onResendInvite: a.onResendInvite,
        onRegenerate: a.onRegenerate,
        onRevokeInvitation: a.onRevokeInvitation,
      })}
      data={vm.pendingInvitations}
      searchPlaceholder="Search invitations…"
      empty={INVITATIONS_EMPTY}
    />
  </TabsContent>
);

const DirectoryTabs = ({
  vm,
  ...a
}: { readonly vm: DirectoryVM } & DirectoryActions) => (
  <Tabs defaultValue="customers">
    <TabsList>
      <TabsTrigger value="staff">
        Staff <Count n={vm.staff.length} />
      </TabsTrigger>
      <TabsTrigger value="customers">
        Organizations <Count n={vm.customers.length} />
      </TabsTrigger>
      <TabsTrigger value="invitations">
        Invitations <Count n={vm.pendingInvitations.length} />
      </TabsTrigger>
      <TabsTrigger value="orphans">
        Orphans <Count n={vm.orphans.length} />
      </TabsTrigger>
    </TabsList>
    <StaffTab vm={vm} a={a} />
    <TabsContent value="customers">
      <OrganizationsPanel
        vm={vm}
        onBlock={a.onBlock}
        onAdmin={a.onAdmin}
        onOpenOrg={a.onOpenOrg}
        onScheduleDeletion={a.onScheduleDeletion}
        onCancelDeletion={a.onCancelDeletion}
        onExportOrg={a.onExportOrg}
        onExportDirectory={a.onExportDirectory}
      />
    </TabsContent>
    <InvitationsTab vm={vm} a={a} />
    <TabsContent value="orphans">
      <DataTable
        columns={orphanColumns({
          onInviteOrphan: a.onInviteOrphan,
          onDeleteOrphan: a.onDeleteOrphan,
        })}
        data={vm.orphans}
        searchPlaceholder="Search orphans…"
        empty={ORPHANS_EMPTY}
      />
    </TabsContent>
  </Tabs>
);

/** Directory-level CTA — invite a new person by email (opens a small dialog). */
export const DirectoryView = ({
  vm,
  ...actions
}: { readonly vm: DirectoryVM } & DirectoryActions) => {
  if (vm.loading)
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-40" />
        {['a', 'b', 'c', 'd', 'e'].map((k) => (
          <Skeleton key={k} className="h-12 w-full" />
        ))}
      </div>
    );
  if (vm.error)
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn&rsquo;t load the directory</AlertTitle>
        <AlertDescription>{vm.error}</AlertDescription>
      </Alert>
    );
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Directory</h1>
        <p className="text-sm text-muted-foreground">
          Staff, organizations, invitations and orphaned identities.
        </p>
      </div>
      <DirectoryTabs vm={vm} {...actions} />
    </div>
  );
};
