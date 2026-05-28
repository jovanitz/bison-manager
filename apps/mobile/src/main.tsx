import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ItemScreen, UseCasesProvider } from '@acme/ui';
import { createMobileRuntime } from './composition-root';
import { nativePlugins } from './native-plugins';

const runtime = createMobileRuntime({
  apiBaseUrl: import.meta.env['VITE_API_BASE_URL'] ?? 'http://localhost:3333',
  plugins: nativePlugins,
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
