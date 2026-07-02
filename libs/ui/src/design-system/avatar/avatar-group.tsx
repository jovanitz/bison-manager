import { Children, isValidElement, type ReactNode } from 'react';
import { cn } from '../cn';
import { Avatar } from './avatar';

export type AvatarGroupProps = {
  /** Max avatars to show before collapsing the rest into a "+N" chip. */
  readonly max?: number;
  /** Size of the "+N" overflow chip — match the children's size. */
  readonly size?: 'sm' | 'md' | 'lg';
  readonly className?: string;
  /** Avatar elements. */
  readonly children: ReactNode;
};

/**
 * Overlapping stack of avatars (member lists, assignees). Shows up to `max`, then
 * a "+N" chip for the remainder. Each item gets a background ring so the overlap
 * reads on any surface. Give the children and `size` the same value.
 */
export const AvatarGroup = ({
  max = 4,
  size = 'md',
  className,
  children,
}: AvatarGroupProps) => {
  const items = Children.toArray(children);
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  return (
    <div className={cn('flex items-center', className)}>
      {shown.map((child, i) => (
        <span
          key={isValidElement(child) ? child.key : i}
          className="rounded-full ring-2 ring-background [&:not(:first-child)]:-ml-2"
        >
          {child}
        </span>
      ))}
      {rest > 0 ? (
        <span className="-ml-2 rounded-full ring-2 ring-background">
          <Avatar
            size={size}
            fallback={`+${rest}`}
            aria-label={`${rest} more`}
          />
        </span>
      ) : null}
    </div>
  );
};
