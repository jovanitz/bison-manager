/**
 * Health header for the Organizations tab — a strip of billing-lifecycle counts
 * (Active · In grace · Suspended · Dormant · Overdue). Each stat is a segment
 * button: clicking it isolates that slice via the filters (and clicking again
 * clears). Counts are derived from the VM upstream; this stays presentational.
 */
import { cn } from '../../../../design-system/cn';
import { emptyFilters, type OrgFilters } from './filters';

export type HealthCounts = {
  readonly active: number;
  readonly grace: number;
  readonly suspended: number;
  readonly dormant: number;
  readonly overdue: number;
};

type Tone = 'success' | 'warning' | 'destructive' | 'muted';

const TONE: Record<Tone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
  muted: 'text-foreground',
};

const isolate = (patch: Partial<OrgFilters>): OrgFilters => ({
  ...emptyFilters,
  ...patch,
});

type Seg = {
  readonly key: keyof HealthCounts;
  readonly label: string;
  readonly tone: Tone;
  readonly isOn: (f: OrgFilters) => boolean;
  readonly apply: () => OrgFilters;
};

const SEGMENTS: readonly Seg[] = [
  {
    key: 'active',
    label: 'Active',
    tone: 'success',
    isOn: (f) => f.phases.has('active'),
    apply: () => isolate({ phases: new Set(['active']) }),
  },
  {
    key: 'grace',
    label: 'In grace',
    tone: 'warning',
    isOn: (f) => f.phases.has('grace'),
    apply: () => isolate({ phases: new Set(['grace']) }),
  },
  {
    key: 'suspended',
    label: 'Suspended',
    tone: 'destructive',
    isOn: (f) => f.phases.has('suspended'),
    apply: () => isolate({ phases: new Set(['suspended']) }),
  },
  {
    key: 'dormant',
    label: 'Dormant',
    tone: 'muted',
    isOn: (f) => f.dormant,
    apply: () => isolate({ dormant: true }),
  },
  {
    key: 'overdue',
    label: 'Overdue',
    tone: 'destructive',
    isOn: (f) => f.needsAttention,
    apply: () => isolate({ needsAttention: true }),
  },
];

const StatCard = ({
  label,
  count,
  tone,
  active,
  onClick,
}: {
  readonly label: string;
  readonly count: number;
  readonly tone: Tone;
  readonly active: boolean;
  readonly onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      'min-w-[5.5rem] flex-1 rounded-lg border px-3 py-2 text-left transition-colors',
      active
        ? 'border-primary/50 bg-primary/5'
        : 'border-border hover:bg-muted/40',
    )}
  >
    <div className={cn('text-lg font-semibold tabular-nums', TONE[tone])}>
      {count}
    </div>
    <div className="text-xs text-muted-foreground">{label}</div>
  </button>
);

export const HealthStrip = ({
  counts,
  filters,
  setFilters,
}: {
  readonly counts: HealthCounts;
  readonly filters: OrgFilters;
  readonly setFilters: (f: OrgFilters) => void;
}) => (
  <div className="flex flex-wrap gap-2">
    {SEGMENTS.map((s) => (
      <StatCard
        key={s.key}
        label={s.label}
        count={counts[s.key]}
        tone={s.tone}
        active={s.isOn(filters)}
        onClick={() => setFilters(s.isOn(filters) ? emptyFilters : s.apply())}
      />
    ))}
  </div>
);
