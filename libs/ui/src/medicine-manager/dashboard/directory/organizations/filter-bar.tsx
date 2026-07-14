/**
 * Filter bar for the Organizations tab. "Needs attention" (preset) and Payment
 * are direct chips; the multi-value facets (Status / Plan) collapse into compact
 * dropdowns so the bar stays to a few controls that breathe on mobile instead of
 * a wall of wrapping chips. Filtering is local UI state (see organizations.tsx).
 */
import { type ReactNode } from 'react';
import { AlertTriangle, ChevronDown, Moon, Trash2 } from 'lucide-react';
import { cn } from '../../../../design-system/cn';
import { Button } from '../../../../design-system/button/button';
import { Separator } from '../../../../design-system/separator/separator';
import { Toggle } from '../../../../design-system/toggle/toggle';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../../../../design-system/dropdown-menu/dropdown-menu';
import {
  emptyFilters,
  filtersActive,
  toggleIn,
  type OrgFilters,
} from './filters';

const STATUS_FACET: readonly {
  readonly value: string;
  readonly label: string;
}[] = [
  { value: 'active', label: 'Active' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'disabled', label: 'Disabled' },
];

const CHIP =
  'h-7 shrink-0 rounded-full px-3 text-xs data-[state=on]:border-primary/40 data-[state=on]:bg-primary/10 data-[state=on]:text-foreground';

const FacetDropdown = ({
  label,
  options,
  selected,
  onToggle,
}: {
  readonly label: string;
  readonly options: readonly {
    readonly value: string;
    readonly label: string;
  }[];
  readonly selected: ReadonlySet<string>;
  readonly onToggle: (value: string) => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="outline"
        size="sm"
        className={cn(
          'h-7 shrink-0 gap-1 rounded-full px-3 text-xs',
          selected.size > 0 && 'border-primary/40 bg-primary/5 text-foreground',
        )}
      >
        {label}
        {selected.size > 0 ? (
          <span className="rounded-full bg-primary/15 px-1.5 text-[0.6875rem] font-medium">
            {selected.size}
          </span>
        ) : null}
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      {options.map((o) => (
        <DropdownMenuCheckboxItem
          key={o.value}
          checked={selected.has(o.value)}
          onCheckedChange={() => onToggle(o.value)}
          onSelect={(e) => e.preventDefault()}
        >
          {o.label}
        </DropdownMenuCheckboxItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);

/** One filter chip — icon + label + count, pressed-state styled by CHIP. */
const ChipToggle = ({
  pressed,
  onToggle,
  icon,
  label,
  count,
}: {
  readonly pressed: boolean;
  readonly onToggle: (on: boolean) => void;
  readonly icon: ReactNode;
  readonly label: string;
  readonly count: number;
}) => (
  <Toggle
    size="sm"
    variant="outline"
    pressed={pressed}
    onPressedChange={onToggle}
    className={CHIP}
  >
    {icon}
    {label}
    <span className="text-muted-foreground">{count}</span>
  </Toggle>
);

export const FilterBar = ({
  filters,
  setFilters,
  plans,
  attentionCount,
  dormantCount,
  pendingDeletionCount,
}: {
  readonly filters: OrgFilters;
  readonly setFilters: (f: OrgFilters) => void;
  readonly plans: readonly string[];
  readonly attentionCount: number;
  readonly dormantCount: number;
  readonly pendingDeletionCount: number;
}) => (
  <div className="flex flex-wrap items-center gap-2">
    <ChipToggle
      pressed={filters.needsAttention}
      onToggle={(on) => setFilters({ ...filters, needsAttention: on })}
      icon={<AlertTriangle className="text-warning" />}
      label="Needs attention"
      count={attentionCount}
    />
    <ChipToggle
      pressed={filters.dormant}
      onToggle={(on) => setFilters({ ...filters, dormant: on })}
      icon={<Moon className="text-muted-foreground" />}
      label="Dormant"
      count={dormantCount}
    />
    {pendingDeletionCount > 0 ? (
      <ChipToggle
        pressed={filters.pendingDeletion}
        onToggle={(on) => setFilters({ ...filters, pendingDeletion: on })}
        icon={<Trash2 className="text-destructive" />}
        label="Pending deletion"
        count={pendingDeletionCount}
      />
    ) : null}
    <Separator orientation="vertical" className="h-6" />
    <FacetDropdown
      label="Status"
      options={STATUS_FACET}
      selected={filters.status}
      onToggle={(v) =>
        setFilters({ ...filters, status: toggleIn(filters.status, v) })
      }
    />
    <FacetDropdown
      label="Plan"
      options={plans.map((p) => ({ value: p, label: p }))}
      selected={filters.plans}
      onToggle={(v) =>
        setFilters({ ...filters, plans: toggleIn(filters.plans, v) })
      }
    />
    {filtersActive(filters) ? (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setFilters(emptyFilters)}
        className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
      >
        Clear
      </Button>
    ) : null}
  </div>
);
