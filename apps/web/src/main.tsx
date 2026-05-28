import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { createWebRuntime } from './composition-root';

// Build the runtime once, at the edge of the app, then hand its use cases to the
// React tree. Nothing inside the tree knows how they were constructed.
const runtime = createWebRuntime({
  apiBaseUrl: import.meta.env['VITE_API_BASE_URL'] ?? 'http://localhost:3333',
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found');

createRoot(rootElement).render(
  <StrictMode>
    <App useCases={runtime.useCases} />
  </StrictMode>,
);
