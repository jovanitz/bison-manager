import { Suspense, lazy, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import {
  UseCasesProvider,
  installDebugBridge,
  type AppUseCases,
} from '@acme/ui';

/**
 * The client shell: providers + routing, deliberately thin. The single route is
 * code-split via `lazy` (SPA + lazy loading); the session gate inside it shows
 * login/signup until authenticated.
 */
const HomeRoute = lazy(() => import('./routes/home-route'));

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Suspense fallback={<p>Loading…</p>}>
        <HomeRoute />
      </Suspense>
    ),
  },
]);

export const App = ({ useCases }: { useCases: AppUseCases }) => {
  const [queryClient] = useState(() => new QueryClient());

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
