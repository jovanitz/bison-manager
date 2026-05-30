import { createContext, useContext, type ReactNode } from 'react';
import type { ItemUseCases } from '@acme/application';

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
