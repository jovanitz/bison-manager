/**
 * Minimal classname combiner. (In a real app you'd use `clsx` + `tailwind-merge`;
 * kept dependency-free here so the reference architecture stays portable.)
 */
export const cn = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');
