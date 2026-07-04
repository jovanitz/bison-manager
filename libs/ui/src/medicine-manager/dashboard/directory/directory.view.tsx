/**
 * Medicine Manager · Dashboard · Directory — staff, customers, invitations,
 * orphaned identities (the implemented dashboard-screen tables, re-skinned).
 *
 * @screen Medicine Manager / Dashboard / Directory
 * @phase draft
 *
 * Presentational: a pure function of (ViewModel + actions) over the design
 * system. Row types are local (decoupled from application DTOs) so wiring maps
 * to them. Capabilities (canBlock/canAdminAccounts) are DATA on the VM.
 */
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
import {
  customerColumns,
  invitationColumns,
  orphanColumns,
  staffColumns,
  type CustomerRow,
  type DirectoryActions,
  type InvitationRow,
  type OrphanRow,
  type StaffRow,
} from './directory.columns';

export type DirectoryVM = {
  readonly staff: readonly StaffRow[];
  readonly customers: readonly CustomerRow[];
  readonly pendingInvitations: readonly InvitationRow[];
  readonly orphans: readonly OrphanRow[];
  readonly canBlock: boolean;
  readonly canAdminAccounts: boolean;
  readonly loading: boolean;
  readonly error?: string;
};

const Count = ({ n }: { readonly n: number }) => (
  <Badge variant="secondary" className="ml-2">
    {n}
  </Badge>
);

const DirectoryTabs = ({
  vm,
  onBlock,
  onAdmin,
  onRegenerate,
  onOpenOrg,
}: { readonly vm: DirectoryVM } & DirectoryActions) => (
  <Tabs defaultValue="staff">
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
    <TabsContent value="staff">
      <DataTable
        columns={staffColumns}
        data={vm.staff}
        searchPlaceholder="Search staff…"
      />
    </TabsContent>
    <TabsContent value="customers">
      <DataTable
        columns={customerColumns({
          canBlock: vm.canBlock,
          canAdminAccounts: vm.canAdminAccounts,
          onBlock,
          onAdmin,
          onOpenOrg,
        })}
        data={vm.customers}
        searchPlaceholder="Search organizations…"
      />
    </TabsContent>
    <TabsContent value="invitations">
      <DataTable
        columns={invitationColumns(onRegenerate)}
        data={vm.pendingInvitations}
        searchPlaceholder="Search invitations…"
        empty="No pending invitations."
      />
    </TabsContent>
    <TabsContent value="orphans">
      <DataTable
        columns={orphanColumns}
        data={vm.orphans}
        searchPlaceholder="Search orphans…"
        empty="No orphaned identities."
      />
    </TabsContent>
  </Tabs>
);

export const DirectoryView = ({
  vm,
  ...actions
}: { readonly vm: DirectoryVM } & DirectoryActions) => {
  if (vm.loading) return <Skeleton className="h-96 w-full" />;
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
