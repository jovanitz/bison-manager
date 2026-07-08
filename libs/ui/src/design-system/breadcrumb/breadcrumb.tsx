import type { ComponentProps } from 'react';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../cn';

/** Breadcrumb trail (shadcn/ui). Semantic nav > ol > li; presentational. */
export const Breadcrumb = (props: ComponentProps<'nav'>) => (
  <nav aria-label="breadcrumb" {...props} />
);

export const BreadcrumbList = ({
  className,
  ...props
}: ComponentProps<'ol'>) => (
  <ol
    className={cn(
      'flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2',
      className,
    )}
    {...props}
  />
);

export const BreadcrumbItem = ({
  className,
  ...props
}: ComponentProps<'li'>) => (
  <li
    className={cn('inline-flex items-center gap-1.5', className)}
    {...props}
  />
);

export const BreadcrumbLink = ({
  className,
  asChild,
  ...props
}: ComponentProps<'a'> & { readonly asChild?: boolean }) => {
  const Comp = asChild ? Slot : 'a';
  return (
    <Comp
      className={cn('transition-colors hover:text-foreground', className)}
      {...props}
    />
  );
};

export const BreadcrumbPage = ({
  className,
  ...props
}: ComponentProps<'span'>) => (
  <span
    role="link"
    aria-disabled="true"
    aria-current="page"
    className={cn('font-normal text-foreground', className)}
    {...props}
  />
);

export const BreadcrumbSeparator = ({
  children,
  className,
  ...props
}: ComponentProps<'li'>) => (
  <li
    role="presentation"
    aria-hidden
    className={cn('[&>svg]:size-3.5', className)}
    {...props}
  >
    {children ?? <ChevronRight />}
  </li>
);

export const BreadcrumbEllipsis = ({
  className,
  ...props
}: ComponentProps<'span'>) => (
  <span
    role="presentation"
    aria-hidden
    className={cn('flex size-9 items-center justify-center', className)}
    {...props}
  >
    <MoreHorizontal className="size-4" />
    <span className="sr-only">More</span>
  </span>
);
