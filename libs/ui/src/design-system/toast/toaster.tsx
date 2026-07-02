import type { CSSProperties } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

/**
 * Toast host (shadcn/ui over Sonner). Mount ONCE near the app root, then fire
 * toasts imperatively with `toast(...)` / `toast.success(...)` / `toast.error(...)`.
 * Themed through design tokens via Sonner's CSS vars, so it follows light/dark
 * (and brand) automatically — no `theme` prop wiring needed.
 */
export const Toaster = ({ richColors = true, ...props }: ToasterProps) => (
  <Sonner
    richColors={richColors}
    className="toaster group"
    // Map Sonner's surface vars to our tokens so the toast follows light/dark +
    // brand with no `theme` wiring. (Action/cancel buttons keep Sonner's
    // theme-aware defaults — the maintained shadcn approach; richColors per call.)
    style={
      {
        '--normal-bg': 'var(--popover)',
        '--normal-text': 'var(--popover-foreground)',
        '--normal-border': 'var(--border)',
      } as CSSProperties
    }
    {...props}
  />
);

export { toast } from 'sonner';
