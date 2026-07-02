import type { ComponentProps } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '../cn';
import { buttonVariants } from '../button/button';

/** Pagination (shadcn/ui). Presentational — wire hrefs/onClick per app. */
export const Pagination = ({ className, ...props }: ComponentProps<'nav'>) => (
  <nav
    aria-label="pagination"
    className={cn('mx-auto flex w-full justify-center', className)}
    {...props}
  />
);

export const PaginationContent = ({
  className,
  ...props
}: ComponentProps<'ul'>) => (
  <ul
    className={cn('flex flex-row items-center gap-1', className)}
    {...props}
  />
);

export const PaginationItem = ({ ...props }: ComponentProps<'li'>) => (
  <li {...props} />
);

export type PaginationLinkProps = {
  readonly isActive?: boolean;
} & ComponentProps<'a'>;

export const PaginationLink = ({
  className,
  isActive,
  ...props
}: PaginationLinkProps) => (
  <a
    aria-current={isActive ? 'page' : undefined}
    className={cn(
      buttonVariants({ variant: isActive ? 'outline' : 'ghost', size: 'icon' }),
      'cursor-pointer',
      className,
    )}
    {...props}
  />
);

export const PaginationPrevious = ({
  className,
  ...props
}: ComponentProps<'a'>) => (
  <a
    aria-label="Go to previous page"
    className={cn(
      buttonVariants({ variant: 'ghost' }),
      'cursor-pointer gap-1 pl-2.5',
      className,
    )}
    {...props}
  >
    <ChevronLeft className="size-4" />
    <span>Previous</span>
  </a>
);

export const PaginationNext = ({
  className,
  ...props
}: ComponentProps<'a'>) => (
  <a
    aria-label="Go to next page"
    className={cn(
      buttonVariants({ variant: 'ghost' }),
      'cursor-pointer gap-1 pr-2.5',
      className,
    )}
    {...props}
  >
    <span>Next</span>
    <ChevronRight className="size-4" />
  </a>
);

export const PaginationEllipsis = ({
  className,
  ...props
}: ComponentProps<'span'>) => (
  <span
    aria-hidden
    className={cn('flex size-9 items-center justify-center', className)}
    {...props}
  >
    <MoreHorizontal className="size-4" />
    <span className="sr-only">More pages</span>
  </span>
);
