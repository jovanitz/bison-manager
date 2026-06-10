import { serve } from '@hono/node-server';
import { z } from 'zod';
import { createApiRuntime } from './composition-root';
import { seedWorld } from './seed';

const portSchema = z.coerce.number().int().min(1).max(65535).default(3333);

const DEV_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const port = portSchema.safeParse(process.env['PORT'] ?? undefined);
if (!port.success) {
  console.error(`Invalid PORT: ${process.env['PORT']}`);
  process.exit(1);
}

// Phase-3 identity stub: call with `Authorization: Bearer session-<preset>`
// (owner | support | customer). Phase 4 replaces the seed with Supabase.
const runtime = createApiRuntime({
  seed: seedWorld({
    sessionExpiresAt: new Date(Date.now() + DEV_SESSION_TTL_MS).toISOString(),
  }),
});

serve({ fetch: runtime.app.fetch, port: port.data }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
  console.log(
    `procedures: ${runtime.procedures.map((p) => p.name).join(', ')}`,
  );
});
