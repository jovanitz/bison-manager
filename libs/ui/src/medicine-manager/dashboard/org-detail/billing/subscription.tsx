/**
 * Subscription block for the Org Detail view (ADR-0016) — a view part, pure
 * render of the precomputed `OrgSubscriptionVM` (phase, `overLimit`, price are
 * DATA; nothing is derived here). Staff levers show only with `canManageBilling`.
 */
import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge, type BadgeProps } from '../../../design-system/badge/badge';
import { Button } from '../../../design-system/button/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../design-system/card/card';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '../../../design-system/alert/alert';
import type { OrgSubscriptionVM, SubscriptionPhase } from './org-detail.types';

const phaseVariant: Record<SubscriptionPhase, BadgeProps['variant']> = {
  trialing: 'secondary',
  active: 'success',
  grace: 'warning',
  suspended: 'destructive',
  canceled: 'outline',
};

const phaseLabel: Record<SubscriptionPhase, string> = {
  trialing: 'trialing',
  active: 'active',
  grace: 'grace',
  suspended: 'suspended',
  canceled: 'canceled',
};

/** Prototype "today" — fixtures live around here, so countdowns are stable. */
const NOW = '2026-07-08';
const daysFromNow = (iso: string): number =>
  Math.round((Date.parse(iso) - Date.parse(NOW)) / 86_400_000);
const plural = (n: number): string => (n === 1 ? '' : 's');

const Fact = ({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) => (
  <div className="rounded-md border border-border p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
      {children}
    </div>
  </div>
);

const Seats = ({ sub }: { readonly sub: OrgSubscriptionVM }) => (
  <Fact label="Seats">
    <span className={sub.overLimit ? 'text-destructive' : undefined}>
      {sub.seatsUsed} / {sub.seatsMax ?? '∞'}
    </span>
    {sub.overLimit ? (
      <Badge variant="destructive" appearance="soft" dot>
        Over limit
      </Badge>
    ) : null}
  </Fact>
);

/** Contextual banner — only for the states that need staff attention. Grace is
 *  amber (service still on, counting down); suspended is red (service off,
 *  recoverable). Dormant adds the "flagged for review" note. */
const PhaseAlert = ({ sub }: { readonly sub: OrgSubscriptionVM }) => {
  if (sub.phase === 'grace') {
    const days = sub.graceEndsAt ? daysFromNow(sub.graceEndsAt) : null;
    return (
      <Alert variant="warning">
        <AlertTriangle />
        <AlertTitle>Payment due — service still on</AlertTitle>
        <AlertDescription>
          {days !== null && days >= 0
            ? `Suspends in ${days} day${plural(days)} if unpaid.`
            : 'Suspends soon if unpaid.'}
        </AlertDescription>
      </Alert>
    );
  }
  if (sub.phase === 'suspended') {
    const off = sub.suspendedSince ? -daysFromNow(sub.suspendedSince) : null;
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>
          {sub.dormant ? 'Suspended — flagged for review' : 'Service suspended'}
        </AlertTitle>
        <AlertDescription>
          {off !== null ? `Off for ${off} day${plural(off)}. ` : ''}
          {sub.dormant ? 'Idle 3+ months — review for deletion. ' : ''}
          Reactivate to restore access — no data is lost.
        </AlertDescription>
      </Alert>
    );
  }
  return null;
};

/** Billing levers, contextual to the phase. The primary action is "Reactivate"
 *  when suspended (filled) and "Record payment" otherwise; "Extend trial" only
 *  makes sense while trial-adjacent (trialing / grace). */
const BillingLevers = ({
  phase,
  onMarkPaid,
  onExtendTrial,
  onChangePlan,
}: {
  readonly phase: SubscriptionPhase;
  readonly onMarkPaid: () => void;
  readonly onExtendTrial: () => void;
  readonly onChangePlan: () => void;
}) => {
  const canRecord = phase !== 'canceled';
  const canExtendTrial = phase === 'trialing' || phase === 'grace';
  const suspended = phase === 'suspended';
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {canRecord ? (
        <Button
          variant={suspended ? 'default' : 'outline'}
          size="sm"
          onClick={onMarkPaid}
        >
          {suspended ? 'Reactivate' : 'Record payment'}
        </Button>
      ) : null}
      {canExtendTrial ? (
        <Button variant="outline" size="sm" onClick={onExtendTrial}>
          Extend trial
        </Button>
      ) : null}
      <Button variant="outline" size="sm" onClick={onChangePlan}>
        Change plan
      </Button>
    </div>
  );
};

export const SubscriptionCard = ({
  subscription,
  canManageBilling,
  onMarkPaid,
  onExtendTrial,
  onChangePlan,
}: {
  readonly subscription: OrgSubscriptionVM;
  readonly canManageBilling: boolean;
  readonly onMarkPaid: () => void;
  readonly onExtendTrial: () => void;
  readonly onChangePlan: () => void;
}) => (
  <Card>
    <CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Subscription</CardTitle>
        <Badge variant={phaseVariant[subscription.phase]} appearance="soft" dot>
          {phaseLabel[subscription.phase]}
        </Badge>
      </div>
      <CardDescription>{subscription.planName}</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-4">
      <PhaseAlert sub={subscription} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Seats sub={subscription} />
        <Fact label="Price">{subscription.priceLabel ?? 'No price yet'}</Fact>
        <Fact label="Trial ends">{subscription.trialEndsAt ?? '—'}</Fact>
        <Fact label="Paid through">{subscription.paidThroughAt ?? '—'}</Fact>
      </div>
      {canManageBilling ? (
        <BillingLevers
          phase={subscription.phase}
          onMarkPaid={onMarkPaid}
          onExtendTrial={onExtendTrial}
          onChangePlan={onChangePlan}
        />
      ) : null}
    </CardContent>
  </Card>
);
