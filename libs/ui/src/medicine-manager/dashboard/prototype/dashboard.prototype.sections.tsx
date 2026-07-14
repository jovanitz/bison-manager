/**
 * Interactive PROTOTYPE — the org-detail billing section. The view stays pure
 * (`fn(vm + actions)`); mutations here only rewrite local fixture state so the
 * click-through feels real (mark-paid revives a past_due org, change-plan swaps
 * the labels). The Plans section lives in dashboard.prototype.plans.
 */
import { useState } from 'react';
import { OrgDetailView } from '../org-detail/org-detail.view';
import { StaffDetailView } from '../permissions/permissions.view';
import type { MemberRow } from '../permissions/permissions.types';
import type {
  BillingDialogVM,
  OrgLedgerEntry,
  OrgMemberRow,
  OrgSubscriptionVM,
  RecordPaymentPreview,
} from '../org-detail/org-detail.types';
import {
  demoLedger,
  demoLedgerOwing,
} from '../org-detail/ledger/ledger.fixtures';
import * as fx from './dashboard.prototype.fixtures';

/** Prototype: fake the policy-computed coverage the record-payment dialog shows. */
const previewFor = (s?: OrgSubscriptionVM): RecordPaymentPreview => ({
  periodLabel: 'Current period',
  amountLabel: s?.priceLabel ?? '—',
  newPaidThrough: '2026-08-05',
  ...(s?.phase === 'suspended'
    ? { creditNote: 'Includes credit for the suspension downtime.' }
    : {}),
});

const noop = () => undefined;

/** Pure roster updaters — kept flat so the handlers below don't nest deeply. */
const withBlocked = (
  ms: readonly OrgMemberRow[],
  membershipId: string,
  blocked: boolean,
): OrgMemberRow[] =>
  ms.map((m) => (m.membershipId === membershipId ? { ...m, blocked } : m));

const withDisabled = (
  ms: readonly OrgMemberRow[],
  userId: string,
  disabled: boolean,
): OrgMemberRow[] =>
  ms.map((m) => (m.userId === userId ? { ...m, disabled } : m));

/** Interactive staff-access detail — block/roles/grants and sessions mutate
 *  local fixture state so the click-through feels real. */
export const StaffDetailSection = ({
  member,
  onBack,
}: {
  readonly member: MemberRow;
  readonly onBack: () => void;
}) => {
  const [m, setM] = useState(member);
  const [sessions, setSessions] = useState(fx.permissionsSessions);
  return (
    <StaffDetailView
      vm={{
        member: m,
        availableRoles: fx.permissionsVM.availableRoles,
        sessions,
        canEdit: true,
        canBlock: true,
        canReadSessions: true,
      }}
      onBack={onBack}
      onGrant={(_id, action, scope) =>
        setM((s) => ({
          ...s,
          permissions: [...s.permissions, `${action}:${scope}`],
        }))
      }
      onAssignRoles={(_id, roleIds) => setM((s) => ({ ...s, roleIds }))}
      onBlockIdentity={(_uid, blocked) => setM((s) => ({ ...s, blocked }))}
      onRevokeSession={(sid) =>
        setSessions((ss) => ss.filter((x) => x.id !== sid))
      }
      onRevokeAll={() => setSessions([])}
    />
  );
};

const correct = (
  ledger: readonly OrgLedgerEntry[],
  entryId: string,
  kind: 'void' | 'refund',
  reason: string,
): OrgLedgerEntry[] =>
  ledger.map((e) =>
    e.id === entryId
      ? {
          ...e,
          kind,
          description: kind === 'void' ? 'Void · payment' : 'Refund',
          reason,
        }
      : e,
  );

/** Local ledger state for the prototype — void/refund append a correction. */
const useLedger = (initial: readonly OrgLedgerEntry[]) => {
  const [ledger, setLedger] = useState(initial);
  return {
    ledger,
    onVoidPayment: (id: string, reason: string) =>
      setLedger((l) => correct(l, id, 'void', reason)),
    onRefundPayment: (id: string, reason: string) =>
      setLedger((l) => correct(l, id, 'refund', reason)),
  };
};

/** Local member moderation state for the prototype (block/disable + open panel). */
const useMembers = () => {
  const [members, setMembers] = useState(fx.orgDetailVM.members);
  const [openId, setOpenId] = useState<string | null>(null);
  return {
    members,
    openMember: members.find((m) => m.membershipId === openId),
    onViewMember: (id: string) => setOpenId(id),
    onCloseMember: () => setOpenId(null),
    onBlockMember: (id: string, blocked: boolean) =>
      setMembers((ms) => withBlocked(ms, id, blocked)),
    onSetMemberAccount: (userId: string, action: 'disable' | 'enable') =>
      setMembers((ms) => withDisabled(ms, userId, action === 'disable')),
  };
};

export const OrgDetailSection = ({
  accountId,
  name,
  subscription,
  onBack,
}: {
  readonly accountId: string;
  readonly name: string;
  readonly subscription?: OrgSubscriptionVM | undefined;
  readonly onBack: () => void;
}) => {
  const [sub, setSub] = useState(subscription ?? fx.orgDetailVM.subscription);
  const [dialog, setDialog] = useState<BillingDialogVM | undefined>(undefined);
  const mem = useMembers();
  const led = useLedger(
    sub?.phase === 'suspended' ? demoLedgerOwing : demoLedger,
  );
  const close = () => setDialog(undefined);
  const patch = (p: Partial<OrgSubscriptionVM>) =>
    setSub((s) => (s ? { ...s, ...p } : s));
  return (
    <OrgDetailView
      vm={{
        ...fx.orgDetailVM,
        accountId,
        name,
        subscription: sub,
        billingDialog: dialog,
        members: mem.members,
        openMember: mem.openMember,
        ledger: led.ledger,
      }}
      onBack={onBack}
      onImpersonate={noop}
      onMarkPaid={() =>
        setDialog({ kind: 'mark-paid', preview: previewFor(sub) })
      }
      onExtendTrial={() => setDialog({ kind: 'extend-trial' })}
      onChangePlan={() =>
        setDialog({ kind: 'change-plan', options: fx.changePlanOptions })
      }
      onCloseBillingDialog={close}
      onSubmitMarkPaid={(paidThrough) => {
        patch({ paidThroughAt: paidThrough, phase: 'active' });
        close();
      }}
      onSubmitExtendTrial={(trialEndsAt) => {
        patch({ trialEndsAt, phase: 'trialing' });
        close();
      }}
      onSubmitChangePlan={(planId) => {
        const target = fx.changePlanOptions.find((o) => o.planId === planId);
        if (target)
          patch({ planName: target.label, priceLabel: target.priceLabel });
        close();
      }}
      onViewMember={mem.onViewMember}
      onCloseMember={mem.onCloseMember}
      onBlockMember={mem.onBlockMember}
      onSetMemberAccount={mem.onSetMemberAccount}
      onVoidPayment={led.onVoidPayment}
      onRefundPayment={led.onRefundPayment}
    />
  );
};
