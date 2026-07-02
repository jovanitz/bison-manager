import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names the shadcn/ui way: `clsx` handles conditionals, then
 * `tailwind-merge` resolves conflicting Tailwind utilities so a later class
 * (e.g. a passed `className`) cleanly overrides an earlier one.
 */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
