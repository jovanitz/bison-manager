/** The change-plan dialog for the Org Detail billing levers (ADR-0016). */
import { useState } from 'react';
import { Badge } from '../../../../design-system/badge/badge';
import { Button } from '../../../../design-system/button/button';
import {
  RadioGroup,
  RadioGroupItem,
} from '../../../../design-system/radio-group/radio-group';
import type { PlanOption } from '../org-detail.types';
import { ReasonField, Shell } from './dialog-shell';

const PlanRow = ({ option }: { readonly option: PlanOption }) => (
  <label
    className={`flex items-center gap-3 rounded-md border border-border p-3 ${
      option.current ? 'opacity-60' : 'cursor-pointer hover:bg-muted/50'
    }`}
  >
    <RadioGroupItem value={option.planId} disabled={option.current} />
    <span className="flex flex-1 flex-wrap items-center gap-2 text-sm font-medium text-foreground">
      {option.label}
      {option.hidden ? (
        <Badge variant="secondary" appearance="soft">
          Hidden
        </Badge>
      ) : null}
      {option.current ? (
        <Badge variant="outline" appearance="soft">
          Current
        </Badge>
      ) : null}
    </span>
    <span className="text-xs text-muted-foreground">
      {option.priceLabel ?? 'No price yet'}
    </span>
  </label>
);

export const ChangePlanDialog = ({
  options,
  onClose,
  onSubmit,
}: {
  readonly options: readonly PlanOption[];
  readonly onClose: () => void;
  readonly onSubmit: (planId: string, reason: string) => void;
}) => {
  const [planId, setPlanId] = useState('');
  const [reason, setReason] = useState('');
  return (
    <Shell
      title="Change plan"
      onClose={onClose}
      footer={
        <Button
          disabled={planId === '' || reason.trim() === ''}
          onClick={() => onSubmit(planId, reason)}
        >
          Change plan
        </Button>
      }
    >
      <RadioGroup value={planId} onValueChange={setPlanId}>
        {options.map((option) => (
          <PlanRow key={option.planId} option={option} />
        ))}
      </RadioGroup>
      <ReasonField value={reason} onChange={setReason} />
    </Shell>
  );
};
