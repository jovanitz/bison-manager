/**
 * Member detail — a right-side panel (Sheet) over a roster row: the user's
 * identity + membership info (ids included) and the moderation levers. Block is
 * a soft, per-org suspension (`members.block`); Disable turns off the whole
 * account (identity-level). The org owner and root identities are protected.
 */
import type { ReactNode } from 'react';
import { Ban, Power, RotateCcw, ShieldCheck } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../../../design-system/sheet/sheet';
import { Badge } from '../../../design-system/badge/badge';
import { Button } from '../../../design-system/button/button';
import { Separator } from '../../../design-system/separator/separator';
import {
  isProtectedMember,
  memberStatus,
  memberStatusVariant,
} from './org-detail.columns';
import type { OrgDetailActions, OrgMemberRow } from './org-detail.types';

type SheetActions = Pick<
  OrgDetailActions,
  'onCloseMember' | 'onBlockMember' | 'onSetMemberAccount'
>;

const Field = ({
  label,
  mono = false,
  children,
}: {
  readonly label: string;
  readonly mono?: boolean;
  readonly children: ReactNode;
}) => (
  <div className="flex flex-col gap-0.5">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd
      className={
        mono
          ? 'break-all font-mono text-xs text-foreground'
          : 'text-sm text-foreground'
      }
    >
      {children}
    </dd>
  </div>
);

const Moderation = ({
  member,
  actions,
}: {
  readonly member: OrgMemberRow;
  readonly actions: SheetActions;
}) => {
  if (isProtectedMember(member))
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0" />
        The owner and root identities are protected.
      </p>
    );
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        onClick={() =>
          actions.onBlockMember(member.membershipId, !member.blocked)
        }
      >
        {member.blocked ? <RotateCcw /> : <Ban />}
        {member.blocked ? 'Unblock in this org' : 'Block in this org'}
      </Button>
      <Button
        variant="outline"
        className="text-destructive hover:text-destructive"
        onClick={() =>
          actions.onSetMemberAccount(
            member.userId,
            member.disabled ? 'enable' : 'disable',
          )
        }
      >
        {member.disabled ? <RotateCcw /> : <Power />}
        {member.disabled ? 'Enable account' : 'Disable account'}
      </Button>
    </div>
  );
};

const Body = ({
  member,
  actions,
}: {
  readonly member: OrgMemberRow;
  readonly actions: SheetActions;
}) => (
  <div className="flex flex-col gap-6 px-4 pb-6">
    <dl className="grid grid-cols-2 gap-4">
      <Field label="Role">{member.role}</Field>
      <Field label="Joined">{member.joinedAt}</Field>
      <Field label="Email">{member.email}</Field>
      <Field label="User ID" mono>
        {member.userId}
      </Field>
      <Field label="Membership ID" mono>
        {member.membershipId}
      </Field>
    </dl>
    <Separator />
    <Moderation member={member} actions={actions} />
  </div>
);

export const MemberSheet = ({
  member,
  onCloseMember,
  onBlockMember,
  onSetMemberAccount,
}: { readonly member?: OrgMemberRow | undefined } & SheetActions) => (
  <Sheet
    open={!!member}
    onOpenChange={(open) => (open ? undefined : onCloseMember())}
  >
    {member ? (
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle>{member.name}</SheetTitle>
            <Badge
              variant={memberStatusVariant[memberStatus(member)]}
              appearance="soft"
              dot
            >
              {memberStatus(member)}
            </Badge>
          </div>
        </SheetHeader>
        <Body
          member={member}
          actions={{ onCloseMember, onBlockMember, onSetMemberAccount }}
        />
      </SheetContent>
    ) : null}
  </Sheet>
);
