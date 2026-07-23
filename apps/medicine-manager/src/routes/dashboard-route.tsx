import { useState } from 'react';
import {
  DashboardShell,
  DirectorySection,
  OrgDetailSection,
  PlansSection,
  RolesSection,
  TemplatesSection,
  SettingsSection,
  StaffDetailSection,
  RequireAdmin,
  type DashboardSection,
} from '@acme/ui';

/**
 * The protected medicine-manager dashboard, in its own module so the router can
 * `lazy`-load it as a separate chunk. `RequireAdmin` shows the login gate until
 * an authorized staff member is present, then renders the shell. The shell owns
 * section navigation; Directory is live and drills down IN-PAGE (master/detail,
 * not a route) to the org-detail screen when a row is opened. Other nav entries
 * are placeholders until their slices land; staff drill-down stays a follow-up.
 */

const Placeholder = ({ section }: { readonly section: DashboardSection }) => (
  <div className="mx-auto max-w-md p-10 text-center">
    <h1 className="text-lg font-medium text-foreground">{section}</h1>
    <p className="mt-2 text-sm text-muted-foreground">
      This section isn’t wired yet. Directory, Plans, Roles and Templates are
      live — pick one from the nav.
    </p>
  </div>
);

type StaffTarget = { readonly userId: string; readonly accountId: string };

const DirectoryPane = ({
  onOpenOrg,
  onOpenStaff,
}: {
  readonly onOpenOrg: (accountId: string) => void;
  readonly onOpenStaff: (staff: StaffTarget) => void;
}) => <DirectorySection onOpenOrg={onOpenOrg} onOpenStaff={onOpenStaff} />;

const MedicineManagerDashboard = () => {
  const [active, setActive] = useState<DashboardSection>('Directory');
  const [openOrgId, setOpenOrgId] = useState<string | null>(null);
  const [openStaff, setOpenStaff] = useState<StaffTarget | null>(null);
  const navigate = (section: DashboardSection) => {
    setOpenOrgId(null);
    setOpenStaff(null);
    setActive(section);
  };
  // Directory drills down in-page to an org OR a staff member (by identity).
  const directory = () => {
    if (openOrgId !== null)
      return (
        <OrgDetailSection
          accountId={openOrgId}
          onBack={() => setOpenOrgId(null)}
        />
      );
    if (openStaff !== null)
      return (
        <StaffDetailSection
          userId={openStaff.userId}
          accountId={openStaff.accountId}
          onBack={() => setOpenStaff(null)}
        />
      );
    return (
      <DirectoryPane onOpenOrg={setOpenOrgId} onOpenStaff={setOpenStaff} />
    );
  };
  // Plans/Roles/Templates/Settings are their own wired sections; the rest are
  // placeholders. A function (not a nested ternary) keeps the lint happy.
  const content = () => {
    if (active === 'Directory') return directory();
    if (active === 'Plans') return <PlansSection />;
    if (active === 'Roles') return <RolesSection />;
    if (active === 'Templates') return <TemplatesSection />;
    if (active === 'Settings') return <SettingsSection />;
    return <Placeholder section={active} />;
  };
  return (
    <DashboardShell active={active} onNavigate={navigate}>
      {content()}
    </DashboardShell>
  );
};

const DashboardRoute = () => (
  <RequireAdmin>
    <MedicineManagerDashboard />
  </RequireAdmin>
);

export default DashboardRoute;
