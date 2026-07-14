import { useState } from 'react';
import {
  DashboardShell,
  DirectorySection,
  RequireAdmin,
  type DashboardSection,
} from '@acme/ui';

/**
 * The protected medicine-manager dashboard, in its own module so the router can
 * `lazy`-load it as a separate chunk. `RequireAdmin` shows the login gate until
 * an authorized staff member is present, then renders the shell. The shell owns
 * section navigation; today only Directory is wired (its store/flow/mapper over
 * the DI bundle) — the other nav entries are placeholders until their slices
 * land. Org/staff drill-down is a deliberate follow-up (no detail screen yet).
 */
const noop = () => undefined;

const Placeholder = ({ section }: { readonly section: DashboardSection }) => (
  <div className="mx-auto max-w-md p-10 text-center">
    <h1 className="text-lg font-medium text-foreground">{section}</h1>
    <p className="mt-2 text-sm text-muted-foreground">
      This section isn’t wired yet. The Directory is live — pick it from the
      nav.
    </p>
  </div>
);

const SectionContent = ({ section }: { readonly section: DashboardSection }) =>
  section === 'Directory' ? (
    <DirectorySection onOpenOrg={noop} onOpenStaff={noop} />
  ) : (
    <Placeholder section={section} />
  );

const MedicineManagerDashboard = () => {
  const [active, setActive] = useState<DashboardSection>('Directory');
  return (
    <DashboardShell active={active} onNavigate={setActive}>
      <SectionContent section={active} />
    </DashboardShell>
  );
};

const DashboardRoute = () => (
  <RequireAdmin>
    <MedicineManagerDashboard />
  </RequireAdmin>
);

export default DashboardRoute;
