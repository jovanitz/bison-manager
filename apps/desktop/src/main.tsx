import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ItemScreen, UseCasesProvider } from '@acme/ui';
import { createDesktopRuntime } from './composition-root';
import { tauriApis } from './native-apis';

const runtime = createDesktopRuntime({
  apiBaseUrl: import.meta.env['VITE_API_BASE_URL'] ?? 'http://localhost:3333',
  apis: tauriApis,
});

const queryClient = new QueryClient();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found');

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <UseCasesProvider useCases={runtime.useCases}>
        <ItemScreen />
      </UseCasesProvider>
    </QueryClientProvider>
  </StrictMode>,
);
