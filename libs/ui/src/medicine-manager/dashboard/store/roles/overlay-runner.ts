import type { Result } from '@acme/shared';

/**
 * The busy → await → (apply + reload) | (inline error) pattern shared by every
 * Roles/Templates mutation. VM-agnostic: `patch` writes the busy/error flags
 * onto whichever overlay is open; `onOk` closes + reloads on success. Kept
 * generic so the roles + templates stores both reuse it without a shared Ctx.
 */
export const runOverlay = async (
  patch: (busy: boolean, error?: string) => void,
  call: () => Promise<Result<unknown, { readonly message: string }>>,
  onOk: () => Promise<void>,
): Promise<void> => {
  patch(true);
  const result = await call();
  if (result.ok) await onOk();
  else patch(false, result.error.message);
};
