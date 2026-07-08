import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '../cn';

/** Accessible tooltip (shadcn/ui over Radix). Sits on a softened charcoal
 *  surface (`--tooltip`), not the harsh pure `--foreground`, so it doesn't
 *  vibrate as near-black on white / near-white on dark. */
export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = forwardRef<
  ElementRef<typeof TooltipPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 overflow-hidden rounded-md bg-tooltip px-2.5 py-1 text-xs font-medium text-tooltip-foreground shadow-md',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;
