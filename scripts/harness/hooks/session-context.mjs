#!/usr/bin/env node
/**
 * Stage 0 — SessionStart hook.
 * Injects a short orientation so the agent starts situated. Non-blocking.
 */
import { readFileSync } from 'node:fs';

try {
  readFileSync(0, 'utf8'); // drain stdin (hook payload), unused here
} catch {
  /* no stdin is fine */
}

const context = [
  'Acme AI harness active.',
  'Architecture: Clean + Hexagonal, Nx monorepo. Dependencies point inward.',
  'Layer import rules (authoritative): docs/ai/capabilities.json.',
  'Build features inside-out: port TYPE first → use-case spec (in-memory adapters) → adapter contract test → screen test → wire in apps/*/composition-root.ts.',
  'Hard rules: no classes/decorators; return Result, never throw; domain/application import no framework/browser/DB/HTTP/auth/native.',
  'Auth/access model (identity≠authorization, actor resolution, presets/scopes, multi-org, grants, invitations, soft-block vs hard-disable, root protection): read docs/ai/auth.md before touching anything auth-related.',
  'Before finishing, the Stop hook runs lint+typecheck+test on affected projects — keep it green.',
].join(' ');

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: context,
    },
  }),
);
process.exit(0);
