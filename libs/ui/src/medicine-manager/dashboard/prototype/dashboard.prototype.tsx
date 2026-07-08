/**
 * Navigable dashboard PROTOTYPE — a clickable shell that wires the section
 * navigation (sidebar → section, org → detail, staff → access detail → back)
 * with FIXTURE data and no real logic. Navigation is UI and lives here (a
 * composition), so it does not belong in the pure `.view.tsx` files; when the
 * real app is stood up this state moves to the router/store and the views stay
 * unchanged. Interactive flow simulations live in dashboard.prototype.sections.
 */
import { useState } from 'react';
import { DashboardShell, type DashboardSection } from '../dashboard.shell';
import { DirectoryView } from '../directory/directory.view';
import { RolesView } from '../roles/roles.view';
import { TemplatesView } from '../roles/templates.view';
import { InviteView } from '../invite/invite.view';
import { AuditView } from '../audit/audit.view';
import { SettingsView } from '../settings/settings.view';
import { Toaster, toast } from '../../../design-system/toast/toaster';
import {
  OrgDetailSection,
  StaffDetailSection,
} from './dashboard.prototype.sections';
import { PlansSection } from './dashboard.prototype.plans';
import * as fx from './dashboard.prototype.fixtures';

const noop = () => undefined;

const ADMIN_TOAST: Record<'disable' | 'enable' | 'promote', string> = {
  disable: 'Account disabled',
  enable: 'Account enabled',
  promote: 'Promoted to staff',
};

/** Prototype feedback — every directory mutation confirms with a toast, and the
 *  reversible ones offer Undo (real undo lands when these wire to the backend). */
const dirToasts = {
  onBlock: (_id: string, blocked: boolean) =>
    toast.success(blocked ? 'Organization blocked' : 'Organization unblocked', {
      action: { label: 'Undo', onClick: () => toast('Reverted') },
    }),
  onAdmin: (_id: string, action: 'disable' | 'enable' | 'promote') =>
    toast.success(ADMIN_TOAST[action]),
  onRegenerate: () => toast.success('Invite link regenerated'),
  onCopyInvite: () => toast.success('Invite link copied'),
  onResendInvite: () => toast.success('Invitation resent'),
  onRevokeInvitation: () =>
    toast.success('Invitation revoked', {
      action: { label: 'Undo', onClick: () => toast('Invitation restored') },
    }),
  onInviteOrphan: () => toast.success('Invitation sent'),
  onDeleteOrphan: () => toast.success('Identity deleted'),
};

/** The active section's view, fed with fixtures. Mutating actions are no-ops. */
const Section = ({
  section,
  onOpenOrg,
  onOpenStaff,
}: {
  readonly section: DashboardSection;
  readonly onOpenOrg: (accountId: string) => void;
  readonly onOpenStaff: (accountId: string) => void;
}) => {
  switch (section) {
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
          {...dirToasts}
          onOpenOrg={onOpenOrg}
          onOpenStaff={onOpenStaff}
        />
      );
  }
};

/** Directory drill-downs (org / staff detail) take over the content when open. */
const DashboardBody = ({
  section,
  orgId,
  staffId,
  onOpenOrg,
  onOpenStaff,
  onBackOrg,
  onBackStaff,
}: {
  readonly section: DashboardSection;
  readonly orgId: string | null;
  readonly staffId: string | null;
  readonly onOpenOrg: (id: string) => void;
  readonly onOpenStaff: (id: string) => void;
  readonly onBackOrg: () => void;
  readonly onBackStaff: () => void;
}) => {
  if (section === 'Directory' && orgId) {
    const org = fx.directoryVM.customers.find((c) => c.accountId === orgId);
    return (
      <OrgDetailSection
        accountId={orgId}
        name={org?.displayName ?? fx.orgDetailVM.name}
        onBack={onBackOrg}
      />
    );
  }
  if (section === 'Directory' && staffId) {
    const staff = fx.directoryVM.staff.find((s) => s.accountId === staffId);
    const member = fx.permissionsVM.members.find(
      (m) => m.email === staff?.email,
    );
    if (member)
      return (
        <StaffDetailSection
          key={member.membershipId}
          member={member}
          onBack={onBackStaff}
        />
      );
  }
  return (
    <Section
      section={section}
      onOpenOrg={onOpenOrg}
      onOpenStaff={onOpenStaff}
    />
  );
};

export const DashboardPrototype = () => {
  const [section, setSection] = useState<DashboardSection>('Directory');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const navigate = (next: DashboardSection) => {
    setSection(next);
    setOrgId(null);
    setStaffId(null);
  };
  return (
    <>
      <DashboardShell active={section} onNavigate={navigate}>
        <DashboardBody
          section={section}
          orgId={orgId}
          staffId={staffId}
          onOpenOrg={(id) => {
            setOrgId(id);
            setStaffId(null);
          }}
          onOpenStaff={(id) => {
            setStaffId(id);
            setOrgId(null);
          }}
          onBackOrg={() => setOrgId(null)}
          onBackStaff={() => setStaffId(null)}
        />
      </DashboardShell>
      <Toaster />
    </>
  );
};
