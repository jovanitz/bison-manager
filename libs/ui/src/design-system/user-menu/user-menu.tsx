import type { ReactNode } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { cn } from '../cn';
import { Avatar } from '../avatar/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../dropdown-menu/dropdown-menu';

export type UserMenuProps = {
  readonly name: string;
  readonly email?: string | undefined;
  readonly avatarSrc?: string | undefined;
  /** Initials fallback; derived from `name` when omitted. */
  readonly fallback?: string | undefined;
  /** Show the name + chevron beside the avatar (desktop). Avatar always shows. */
  readonly showName?: boolean;
  /** App items rendered between the identity header and Sign out. */
  readonly children?: ReactNode;
  readonly onSignOut?: (() => void) | undefined;
  readonly className?: string;
};

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase() || '?';

/**
 * Personal account menu for the topbar — the *who am I* control (identity, NOT
 * organization: switching the acting org is OrgSwitcher's job). Avatar trigger →
 * dropdown with an identity header, a slot for app items, and Sign out.
 */
export const UserMenu = ({
  name,
  email,
  avatarSrc,
  fallback,
  showName = false,
  children,
  onSignOut,
  className,
}: UserMenuProps) => {
  const initials = fallback ?? initialsOf(name);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className={cn(
          'inline-flex items-center gap-2 rounded-md p-0.5 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        <Avatar src={avatarSrc} fallback={initials} />
        {showName ? (
          <>
            <span className="hidden max-w-32 truncate text-sm font-medium md:inline">
              {name}
            </span>
            <ChevronDown className="hidden size-4 text-muted-foreground md:inline" />
          </>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex items-center gap-2 p-2">
          <Avatar src={avatarSrc} fallback={initials} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{name}</span>
            {email ? (
              <span className="truncate text-xs text-muted-foreground">
                {email}
              </span>
            ) : null}
          </div>
        </div>
        {children ? (
          <>
            <DropdownMenuSeparator />
            {children}
          </>
        ) : null}
        {onSignOut ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onSignOut}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
