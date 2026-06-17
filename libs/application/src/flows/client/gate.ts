import type { AccessClientUseCases } from '../../access-client/use-cases';

/**
 * Client session gate as a HEADLESS decision. The UI keeps only the reactive
 * shell (subscribe to auth changes, render per state); the rule itself —
 * anonymous → login; authenticated but org-less → create your org; soft-blocked
 * → notice; else → the app — lives here so it can be tested without React.
 */
export type ClientGateState =
  | 'anonymous'
  | 'no-org'
  | 'blocked'
  | 'authenticated';

export type ClientGateDeps = { readonly access: AccessClientUseCases };

export const resolveClientGate = async (
  deps: ClientGateDeps,
): Promise<ClientGateState> => {
  const session = await deps.access.getSession();
  if (!session.ok) return 'anonymous';
  // Valid Supabase session but no actor ⇒ authenticated yet org-less.
  const snapshot = await deps.access.currentAccess();
  if (!snapshot.ok) return 'no-org';
  return snapshot.value.blocked ? 'blocked' : 'authenticated';
};
