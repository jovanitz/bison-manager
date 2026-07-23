import { useState } from 'react';
import {
  DashboardShell,
  DirectorySection,
  OrgDetailSection,
  PlansSection,
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
const noop = () => undefined;

const Placeholder = ({ section }: { readonly section: DashboardSection }) => (
  <div className="mx-auto max-w-md p-10 text-center">
    <h1 className="text-lg font-medium text-foreground">{section}</h1>
    <p className="mt-2 text-sm text-muted-foreground">
      This section isn’t wired yet. Directory and Plans are live — pick one from
      the nav.
    </p>
  </div>
);

const DirectoryPane = ({
  onOpenOrg,
}: {
  readonly onOpenOrg: (accountId: string) => void;
}) => <DirectorySection onOpenOrg={onOpenOrg} onOpenStaff={noop} />;

const MedicineManagerDashboard = () => {
  const [active, setActive] = useState<DashboardSection>('Directory');
  const [openOrgId, setOpenOrgId] = useState<string | null>(null);
  const navigate = (section: DashboardSection) => {
    setOpenOrgId(null);
    setActive(section);
  };
  const directory =
    openOrgId !== null ? (
      <OrgDetailSection
        accountId={openOrgId}
        onBack={() => setOpenOrgId(null)}
      />
    ) : (
      <DirectoryPane onOpenOrg={setOpenOrgId} />
    );
  // Directory drills down in-page; Plans is its own wired section; the rest are
  // placeholders until their slices land. A function (not a nested ternary) so
  // each section stays readable and the lint's no-nested-ternary rule holds.
  const content = () => {
    if (active === 'Directory') return directory;
    if (active === 'Plans') return <PlansSection />;
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
