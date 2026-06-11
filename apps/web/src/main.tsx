import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { createWebRuntime } from './composition-root';

// Build the runtime once, at the edge of the app, then hand its use cases to the
// React tree. Nothing inside the tree knows how they were constructed.
// Local-stack defaults: the anon key printed by `supabase start` is a public,
// well-known dev value (never a secret; production values come from env).
const runtime = createWebRuntime({
  apiBaseUrl: import.meta.env['VITE_API_BASE_URL'] ?? 'http://localhost:3333',
  supabaseUrl:
    import.meta.env['VITE_SUPABASE_URL'] ?? 'http://127.0.0.1:54321',
  supabaseAnonKey:
    import.meta.env['VITE_SUPABASE_ANON_KEY'] ??
    'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found');

createRoot(rootElement).render(
  <StrictMode>
    <App useCases={runtime.useCases} />
  </StrictMode>,
);
