import { createContext, useContext, type ReactNode } from 'react';
import type {
  AccessClientUseCases,
  AccountAdminGateway,
  AuditGateway,
  SessionsGateway,
  SettingsGateway,
  BlockUseCases,
  CoverageReader,
  DirectoryUseCases,
  InvitationsUseCases,
  ItemUseCases,
  MembersUseCases,
  OrgsUseCases,
  RolesGateway,
} from '@acme/application';

/**
 * The UI's dependency-injection seam.
 *
 * The UI layer is forbidden (by the Nx boundary rules) from importing
 * infrastructure or platform. Instead it declares *what* it needs — a bundle of
 * use cases — and reads them from React context. Each app's composition root
 * builds the real (or mock) use cases and provides them here. This is how the
 * very same `ItemScreen` renders against live adapters in `apps/web` and
 * against fakes in tests, with no code change.
 */
export type AppUseCases = {
  readonly items: ItemUseCases;
  /** Present once the app wires auth (web today; mobile/desktop pending). */
  readonly access?: AccessClientUseCases;
  /** Present in the staff dashboard: the staff/customer directory reads. */
  readonly directory?: DirectoryUseCases;
  /** Present in the staff dashboard: per-account billing coverage (ADR-0018). */
  readonly coverage?: CoverageReader;
  /** Present in the staff dashboard: issue invitations + activate them. */
  readonly invitations?: InvitationsUseCases;
  /** Present in the staff dashboard: list members + edit their permissions. */
  readonly members?: MembersUseCases;
  /** Present in the staff dashboard: soft-block orgs / identities. */
  readonly block?: BlockUseCases;
  /** Present in the staff dashboard: manage dynamic roles (ADR-0011). */
  readonly roles?: RolesGateway;
  /** Present in the staff dashboard: account lifecycle (disable/enable/promote). */
  readonly accounts?: AccountAdminGateway;
  /** Present in the staff dashboard: read the security audit trail. */
  readonly audit?: AuditGateway;
  /** Present in the staff dashboard: list + revoke a member's sessions. */
  readonly sessions?: SessionsGateway;
  /** Present in the staff dashboard: read + edit the session policy. */
  readonly settings?: SettingsGateway;
  /** Present in the client app: the caller's orgs + switching between them. */
  readonly orgs?: OrgsUseCases;
};

const UseCasesContext = createContext<AppUseCases | null>(null);

export const UseCasesProvider = ({
  useCases,
  children,
}: {
  useCases: AppUseCases;
  children: ReactNode;
}) => (
  <UseCasesContext.Provider value={useCases}>
    {children}
  </UseCasesContext.Provider>
);

export const useUseCases = (): AppUseCases => {
  const ctx = useContext(UseCasesContext);
  if (!ctx) {
    throw new Error(
      'useUseCases must be used within a <UseCasesProvider>. Wire it in your composition root.',
    );
  }
  return ctx;
};
