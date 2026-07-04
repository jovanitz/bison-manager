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
  past_due: 'warning',
  canceled: 'outline',
};

const phaseLabel: Record<SubscriptionPhase, string> = {
  trialing: 'trialing',
  active: 'active',
  past_due: 'past due',
  canceled: 'canceled',
};

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
      {subscription.phase === 'past_due' ? (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertTitle>Trial ended</AlertTitle>
          <AlertDescription>
            The organization can&rsquo;t grow or use premium features until
            payment.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Seats sub={subscription} />
        <Fact label="Price">{subscription.priceLabel ?? 'No price yet'}</Fact>
        <Fact label="Trial ends">{subscription.trialEndsAt ?? '—'}</Fact>
        <Fact label="Paid through">{subscription.paidThroughAt ?? '—'}</Fact>
      </div>
      {canManageBilling ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" size="sm" onClick={onMarkPaid}>
            Mark paid
          </Button>
          <Button variant="outline" size="sm" onClick={onExtendTrial}>
            Extend trial
          </Button>
          <Button variant="outline" size="sm" onClick={onChangePlan}>
            Change plan
          </Button>
        </div>
      ) : null}
    </CardContent>
  </Card>
);
