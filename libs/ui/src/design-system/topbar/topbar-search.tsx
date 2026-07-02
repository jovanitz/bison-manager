import { forwardRef, type InputHTMLAttributes } from 'react';
import { Search } from 'lucide-react';
import { cn } from '../cn';
import { Input } from '../input/input';

export type TopbarSearchProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Keyboard-shortcut hint shown on the right (e.g. "/"). Visual only —
   *  wire the actual focus-on-key in the app. Hidden on small screens. */
  readonly shortcut?: string | undefined;
  /** Width/positioning go on the wrapper. */
  readonly wrapperClassName?: string | undefined;
};

/** Topbar search field: leading magnifier + optional keyboard-shortcut hint. */
export const TopbarSearch = forwardRef<HTMLInputElement, TopbarSearchProps>(
  ({ className, wrapperClassName, shortcut, ...props }, ref) => (
    <div className={cn('relative', wrapperClassName)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={ref}
        type="search"
        className={cn('pl-8', shortcut && 'pr-9', className)}
        {...props}
      />
      {shortcut ? (
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden h-5 -translate-y-1/2 select-none items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
          {shortcut}
        </kbd>
      ) : null}
    </div>
  ),
);
TopbarSearch.displayName = 'TopbarSearch';
