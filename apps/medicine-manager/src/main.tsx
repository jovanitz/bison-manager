import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './app';
import { createMedicineManagerRuntime } from './composition-root';

// Build the runtime once at the edge, then hand its use cases to the React
// tree. Local-stack defaults mirror apps/dashboard: the anon key printed by
// `supabase start` is a public dev value (never a secret). VITE_DEV_AUTH (dev
// only) swaps Supabase for a static dev session against the API's dev-stub
// seeded world: `=1` skips the login (auto-authenticated), `=login` shows the
// real login screen and any sign-in click drops straight in (to demo the flow).
const devAuthMode = import.meta.env.DEV
  ? import.meta.env['VITE_DEV_AUTH']
  : undefined;
const devAuth = devAuthMode === '1' || devAuthMode === 'login';

const runtime = createMedicineManagerRuntime({
  apiBaseUrl: import.meta.env['VITE_API_BASE_URL'] ?? 'http://localhost:3333',
  supabaseUrl: import.meta.env['VITE_SUPABASE_URL'] ?? 'http://127.0.0.1:54321',
  supabaseAnonKey:
    import.meta.env['VITE_SUPABASE_ANON_KEY'] ??
    'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
  devAuth,
  devStartSignedOut: devAuthMode === 'login',
  devSession: import.meta.env['VITE_DEV_SESSION'] ?? 'session-owner',
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found');

createRoot(rootElement).render(
  <StrictMode>
    <App useCases={runtime.useCases} />
  </StrictMode>,
);
