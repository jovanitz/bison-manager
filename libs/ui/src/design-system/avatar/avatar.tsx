import { useState, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../cn';

/** Avatar shell — circle by default; pass `rounded-md` for an org squircle. */
const avatarVariants = cva(
  'relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-muted-foreground',
  {
    variants: {
      size: {
        sm: 'size-6 text-[10px]',
        md: 'size-8 text-xs',
        lg: 'size-10 text-sm',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

/** Presence states → status-token colors (online reuses the success token, etc). */
export type AvatarStatus = 'online' | 'offline' | 'away' | 'busy';

const statusColor: Record<AvatarStatus, string> = {
  online: 'bg-success',
  away: 'bg-warning',
  busy: 'bg-destructive',
  offline: 'bg-muted-foreground',
};

const dotSize: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'size-1.5',
  md: 'size-2',
  lg: 'size-2.5',
};

export type AvatarProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof avatarVariants> & {
    /** Image URL; falls back to `fallback` initials if absent or it fails. */
    readonly src?: string | undefined;
    readonly alt?: string | undefined;
    /** Initials/short text shown when there's no image. */
    readonly fallback: string;
    /** Optional presence dot in the corner. */
    readonly status?: AvatarStatus | undefined;
  };

/**
 * Dependency-free Avatar. Renders the image when it loads, otherwise the
 * `fallback` initials. Token-based and theme-aware. Override the shape/colors via
 * className (twMerge wins) — e.g. an organization logo uses `rounded-md bg-primary`.
 * Pass `status` for a presence dot (colored via the status tokens).
 */
export const Avatar = ({
  className,
  size,
  src,
  alt,
  fallback,
  status,
  ...props
}: AvatarProps) => {
  const [failed, setFailed] = useState(false);
  const circle = (
    <span className={cn(avatarVariants({ size }), className)} {...props}>
      {src && !failed ? (
        <img
          src={src}
          alt={alt ?? ''}
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden>{fallback}</span>
      )}
    </span>
  );
  if (!status) return circle;
  return (
    <span className="relative inline-flex">
      {circle}
      <span
        aria-label={status}
        className={cn(
          'absolute bottom-0 right-0 rounded-full ring-2 ring-background',
          dotSize[size ?? 'md'],
          statusColor[status],
        )}
      />
    </span>
  );
};
