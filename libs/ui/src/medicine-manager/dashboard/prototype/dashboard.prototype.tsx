/**
 * Navigable dashboard PROTOTYPE — a clickable shell that wires the section
 * navigation (sidebar → section, org → detail → back) with FIXTURE data and no
 * real logic. Navigation is UI and lives here (a composition), so it does not
 * belong in the pure `.view.tsx` files; when the real app is stood up this state
 * moves to the router/store and the views stay unchanged (zero rework).
 * Interactive flow simulations live in dashboard.prototype.sections.tsx.
 */
import { useState } from 'react';
import { DashboardShell, type DashboardSection } from '../dashboard.shell';
import { DirectoryView } from '../directory/directory.view';
import { PermissionsView } from '../permissions/permissions.view';
import { RolesView } from '../roles/roles.view';
import { TemplatesView } from '../roles/templates.view';
import { InviteView } from '../invite/invite.view';
import { AuditView } from '../audit/audit.view';
import { SettingsView } from '../settings/settings.view';
import { OrgDetailSection, PlansSection } from './dashboard.prototype.sections';
import * as fx from './dashboard.prototype.fixtures';

const noop = () => undefined;

/** The active section's view, fed with fixtures. Mutating actions are no-ops. */
const Section = ({
  section,
  onOpenOrg,
}: {
  readonly section: DashboardSection;
  readonly onOpenOrg: (accountId: string) => void;
}) => {
  switch (section) {
    case 'Permissions':
      return (
        <PermissionsView
          vm={fx.permissionsVM}
          sessions={fx.permissionsSessions}
          onGrant={noop}
          onAssignRoles={noop}
          onBlockIdentity={noop}
          onLoadSessions={noop}
          onRevokeSession={noop}
          onRevokeAll={noop}
        />
      );
    case 'Roles':
      return (
        <RolesView
          vm={fx.rolesVM}
          onCreate={noop}
          onReset={noop}
          onDelete={noop}
        />
      );
    case 'Templates':
      return (
        <TemplatesView
          vm={fx.templatesVM}
          onRename={noop}
          onReset={noop}
          onApplyToAll={noop}
        />
      );
    case 'Plans':
      return <PlansSection />;
    case 'Invite':
      return <InviteView vm={fx.inviteVM} onInvite={noop} />;
    case 'Audit':
      return <AuditView vm={fx.auditVM} />;
    case 'Settings':
      return <SettingsView vm={fx.settingsVM} onSave={noop} />;
    default:
      return (
        <DirectoryView
          vm={fx.directoryVM}
          onBlock={noop}
          onAdmin={noop}
          onRegenerate={noop}
          onOpenOrg={onOpenOrg}
        />
      );
  }
};

export const DashboardPrototype = () => {
  const [section, setSection] = useState<DashboardSection>('Directory');
  const [orgId, setOrgId] = useState<string | null>(null);
  return (
    <DashboardShell
      active={section}
      onNavigate={(next) => {
        setSection(next);
        setOrgId(null);
      }}
    >
      {section === 'Directory' && orgId ? (
        <OrgDetailSection
          accountId={orgId}
          name={
            fx.directoryVM.customers.find((c) => c.accountId === orgId)
              ?.displayName ?? fx.orgDetailVM.name
          }
          onBack={() => setOrgId(null)}
        />
      ) : (
        <Section section={section} onOpenOrg={setOrgId} />
      )}
    </DashboardShell>
  );
};
