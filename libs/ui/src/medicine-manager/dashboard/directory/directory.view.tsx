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
import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../../design-system/tabs/tabs';
import { Badge } from '../../../design-system/badge/badge';
import { Button } from '../../../design-system/button/button';
import { Input } from '../../../design-system/input/input';
import { Label } from '../../../design-system/label/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../design-system/dialog/dialog';
import { DataTable } from '../../../design-system/data-table/data-table';
import { Skeleton } from '../../../design-system/skeleton/skeleton';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '../../../design-system/alert/alert';
import {
  staffColumns,
  type DirectoryActions,
  type DirectoryVM,
} from './directory.columns';
import { invitationColumns } from './lists/invitations';
import { orphanColumns } from './lists/orphans';
import { OrganizationsPanel } from './organizations/organizations';

export type { DirectoryVM };

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
  onOpenStaff,
  onCopyInvite,
  onResendInvite,
  onRevokeInvitation,
  onInviteOrphan,
  onDeleteOrphan,
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
    <TabsContent value="staff">
      <DataTable
        columns={staffColumns(onOpenStaff)}
        data={vm.staff}
        searchPlaceholder="Search staff…"
      />
    </TabsContent>
    <TabsContent value="customers">
      <OrganizationsPanel
        vm={vm}
        onBlock={onBlock}
        onAdmin={onAdmin}
        onOpenOrg={onOpenOrg}
      />
    </TabsContent>
    <TabsContent value="invitations">
      <DataTable
        columns={invitationColumns({
          onCopyInvite,
          onResendInvite,
          onRegenerate,
          onRevokeInvitation,
        })}
        data={vm.pendingInvitations}
        searchPlaceholder="Search invitations…"
        empty="No pending invitations."
      />
    </TabsContent>
    <TabsContent value="orphans">
      <DataTable
        columns={orphanColumns({ onInviteOrphan, onDeleteOrphan })}
        data={vm.orphans}
        searchPlaceholder="Search orphans…"
        empty="No orphaned identities."
      />
    </TabsContent>
  </Tabs>
);

/** Directory-level CTA — invite a new person by email (opens a small dialog). */
const InviteDialog = ({
  onInvite,
}: {
  readonly onInvite: (email: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onInvite(email);
    setEmail('');
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite someone</DialogTitle>
          <DialogDescription>
            Send a one-time activation link to their email.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!email}>
              Send invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Directory</h1>
          <p className="text-sm text-muted-foreground">
            Staff, organizations, invitations and orphaned identities.
          </p>
        </div>
        <InviteDialog onInvite={actions.onInvite} />
      </div>
      <DirectoryTabs vm={vm} {...actions} />
    </div>
  );
};
