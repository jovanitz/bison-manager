import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '../cn';
import { Avatar } from '../avatar/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../dropdown-menu/dropdown-menu';

export type Org = {
  readonly id: string;
  readonly name: string;
  /** Initials fallback for the logo. */
  readonly fallback: string;
  readonly logoSrc?: string | undefined;
  /** Optional context line (e.g. role/plan): "Owner", "Staff". */
  readonly caption?: string | undefined;
};

export type OrgSwitcherProps = {
  readonly current: Org;
  readonly orgs: readonly Org[];
  readonly onSelect?: ((id: string) => void) | undefined;
  readonly onCreate?: (() => void) | undefined;
  readonly className?: string;
};

const orgLogo = 'rounded-md bg-primary text-primary-foreground';

const OrgRow = ({
  org,
  active,
  onSelect,
}: {
  readonly org: Org;
  readonly active: boolean;
  readonly onSelect?: ((id: string) => void) | undefined;
}) => (
  <DropdownMenuItem className="gap-2" onSelect={() => onSelect?.(org.id)}>
    <Avatar
      size="sm"
      src={org.logoSrc}
      fallback={org.fallback}
      className={orgLogo}
    />
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-sm font-medium">{org.name}</span>
      {org.caption ? (
        <span className="truncate text-xs text-muted-foreground">
          {org.caption}
        </span>
      ) : null}
    </span>
    {active ? <Check className="size-4 shrink-0 text-primary" /> : null}
  </DropdownMenuItem>
);

/**
 * Organization switcher — the *acting org* control in a multi-org app: each
 * option is a membership/actor you can switch into. Trigger shows the current
 * org's logo + name; the menu lists every org with a check on the active one,
 * plus an optional "Create organization". Identity stays in UserMenu.
 */
export const OrgSwitcher = ({
  current,
  orgs,
  onSelect,
  onCreate,
  className,
}: OrgSwitcherProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      aria-label={`Organization: ${current.name}`}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-md px-1.5 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <Avatar
        size="sm"
        src={current.logoSrc}
        fallback={current.fallback}
        className={orgLogo}
      />
      <span className="hidden max-w-40 truncate text-sm font-medium sm:inline">
        {current.name}
      </span>
      <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="w-64">
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
        Organizations
      </DropdownMenuLabel>
      {orgs.map((org) => (
        <OrgRow
          key={org.id}
          org={org}
          active={org.id === current.id}
          onSelect={onSelect}
        />
      ))}
      {onCreate ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2" onSelect={onCreate}>
            <span className="flex size-6 items-center justify-center rounded-md border border-dashed border-border">
              <Plus className="size-3.5" />
            </span>
            Create organization
          </DropdownMenuItem>
        </>
      ) : null}
    </DropdownMenuContent>
  </DropdownMenu>
);
