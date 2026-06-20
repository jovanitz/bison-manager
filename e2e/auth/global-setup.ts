import { spawnSync } from 'node:child_process';
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  OWNER_EMAIL,
  OWNER_PASSWORD,
} from './fixtures';

/**
 * Boots the real backend the auth e2e needs and seeds the bootstrap-owner user.
 *
 * Heavy + Docker-dependent — which is exactly why the auth e2e lives in its own
 * config (playwright.auth.config.ts), not the default web-only one: the cheap
 * web e2e must not pay for Docker. See docs/ai/methodology.md (e2e coverage).
 */
export default async function globalSetup(): Promise<void> {
  // 1) Local Supabase (Postgres + GoTrue + JWKS). Idempotent: returns fast if
  //    the stack is already up.
  const up = spawnSync('supabase', ['start'], {
    encoding: 'utf8',
    timeout: 180_000,
  });
  if (up.status !== 0 && !/already running/i.test(`${up.stdout}${up.stderr}`)) {
    throw new Error(
      `supabase start failed (is Docker running?):\n${up.stderr || up.stdout}`,
    );
  }

  // 2) Ensure the owner user exists. Local GoTrue auto-confirms, so sign-up
  //    yields a usable account immediately; a re-run hits "already registered",
  //    which is fine (idempotent seed). The anon key is deterministic from the
  //    committed config, but allow a CI override (set from `supabase status`).
  const anonKey = process.env['SUPABASE_ANON_KEY'] ?? SUPABASE_ANON_KEY;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (!/already registered|already exists/i.test(body)) {
      throw new Error(`could not seed ${OWNER_EMAIL}: ${res.status} ${body}`);
    }
  }
}
