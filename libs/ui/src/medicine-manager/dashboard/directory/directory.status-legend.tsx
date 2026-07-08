/**
 * "Status" column header with an info tooltip that defines each org state.
 * The legend mirrors the table: same coloured dot per state, aligned in a
 * two-column grid (state · meaning) so it reads as a key, not a text blob.
 */
import { Fragment } from 'react';
import { Info } from 'lucide-react';
import { cn } from '../../../design-system/cn';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../design-system/tooltip/tooltip';

const LEGEND: readonly {
  readonly label: string;
  readonly meaning: string;
  readonly dot: string;
}[] = [
  { label: 'Active', meaning: 'Operating normally.', dot: 'bg-success' },
  {
    label: 'Blocked',
    meaning: 'Access suspended, reversible.',
    dot: 'bg-warning',
  },
  { label: 'Disabled', meaning: 'Account turned off.', dot: 'bg-destructive' },
];

export const StatusHeader = () => (
  <span className="inline-flex items-center gap-1.5">
    Status
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="What each status means"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <Info className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs p-3">
          <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-2">
            {LEGEND.map((s) => (
              <Fragment key={s.label}>
                <span className="flex items-center gap-1.5 font-medium">
                  <span
                    className={cn('size-1.5 shrink-0 rounded-full', s.dot)}
                  />
                  {s.label}
                </span>
                <span className="text-tooltip-foreground/70">{s.meaning}</span>
              </Fragment>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </span>
);
