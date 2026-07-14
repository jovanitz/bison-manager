import { Suspense, lazy, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import {
  UseCasesProvider,
  installDebugBridge,
  type AppUseCases,
} from '@acme/ui';

/**
 * The medicine-manager shell: providers + routing, deliberately thin. The
 * protected route is code-split via `lazy`, so the initial bundle is just the
 * shell; the dashboard (and its login gate) load on demand.
 */
const DashboardRoute = lazy(() => import('./routes/dashboard-route'));
const ActivateRoute = lazy(() => import('./routes/activate-route'));

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Suspense fallback={<p>Loading…</p>}>
        <DashboardRoute />
      </Suspense>
    ),
  },
  {
    path: '/activate',
    element: (
      <Suspense fallback={<p>Loading…</p>}>
        <ActivateRoute />
      </Suspense>
    ),
  },
]);

export const App = ({ useCases }: { useCases: AppUseCases }) => {
  const [queryClient] = useState(() => new QueryClient());

  // DEV-only runtime introspection bridge (window.__app__) — tree-shaken in prod.
  useEffect(() => {
    if (import.meta.env.DEV) {
      installDebugBridge({ queryClient, useCases });
    }
  }, [queryClient, useCases]);

  return (
    <QueryClientProvider client={queryClient}>
      <UseCasesProvider useCases={useCases}>
        <RouterProvider router={router} />
      </UseCasesProvider>
    </QueryClientProvider>
  );
};
