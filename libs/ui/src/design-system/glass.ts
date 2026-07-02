/**
 * Frosted-glass surface shared by the peek sidebar and the mobile nav drawer:
 * a translucent token tint + blur + saturate + an adaptive light ring, with a
 * primary-tinted top sheen. `bg-card/75` is the readable fallback where
 * backdrop-filter is unsupported; the lower-opacity tint only applies where it is.
 */
export const glassPanel =
  'border-black/[0.06] bg-card/75 ring-1 ring-inset ring-black/[0.06] supports-[backdrop-filter]:bg-card/40 supports-[backdrop-filter]:backdrop-blur-2xl supports-[backdrop-filter]:backdrop-saturate-150 dark:border-white/10 dark:ring-white/10';

/** Primary-tinted top sheen — render as an absolute, non-interactive child. */
export const glassSheen =
  'pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-primary/25 to-transparent dark:from-primary/20';
