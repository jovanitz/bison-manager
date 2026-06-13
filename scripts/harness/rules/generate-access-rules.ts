import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiRuntime } from '../../../apps/api/src/composition-root';
import { renderDecisionMatrix } from './scenarios';
import {
  renderAuditEvents,
  renderDelegableActions,
  renderDurations,
  renderImpersonationRules,
  renderPresetMatrix,
  renderProcedures,
} from './sections';

/**
 * Generates docs/business-rules/access.md FROM the code: domain constants,
 * presets, the api procedure registry, and a decision matrix executed against
 * the real policy core. `--check` (used by the gate) fails when the committed
 * document no longer matches what the code says — so a rule change cannot
 * merge without its human-readable representation changing in the same PR.
 */
const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
const DOC_PATH = path.join(ROOT, 'docs/business-rules/access.md');

const jwtExpirySeconds = (): number => {
  const toml = readFileSync(path.join(ROOT, 'supabase/config.toml'), 'utf8');
  const match = toml.match(/^jwt_expiry\s*=\s*(\d+)/m);
  if (!match) throw new Error('jwt_expiry not found in supabase/config.toml');
  return Number(match[1]);
};

const renderDocument = async (): Promise<string> => {
  const runtime = createApiRuntime({ seed: {} });
  const procedures = renderProcedures(runtime.procedures);
  await runtime.close();

  return `<!-- GENERATED FILE — do not edit by hand.
     Source of truth: the code (libs/domain/src/access, apps/api registry,
     supabase/config.toml). Regenerate: pnpm harness rules --write
     The gate fails while this file is stale (pnpm harness rules). -->

# Access — business rules

Human-readable representation of the authorization system (ADR-0010). Every
table below is derived from — or executed against — the real code.

## Principles

- **Permissions + temporary grants; no roles.** "Owner", "support" and
  "customer" are only administrative presets that expand to permission lists;
  nothing ever asks "is this user an owner?".
- **Deny by default, fail closed.** Anything not explicitly allowed is denied;
  a disabled account or revoked/expired session denies everything.
- **The token never authorizes.** A JWT only proves identity; permissions,
  grants and statuses are loaded fresh from the database on every request, so
  revocation is immediate.
- **Every sensitive action is audited atomically** — the mutation and its
  audit event commit in one transaction.

## Durations

${renderDurations(jwtExpirySeconds())}

## Who can do what (presets)

${renderPresetMatrix()}

Presets are starting bundles: an owner can change any membership's
permissions afterwards (\`permissions.update\` is root-equivalent — whoever
holds it can grant themselves anything *within the coherence rules below*).

## What can live inside a customer organization

${renderDelegableActions()}

## Impersonation

${renderImpersonationRules()}

## Decisions, executed

The rows below are **run through the real policy core** when this document is
generated — they are behavior, not documentation:

${renderDecisionMatrix()}

## API surface

${procedures}

Enforcement never relies on this table's "required action": every use case
re-authorizes itself with the concrete resource in hand.

## Audit events

${renderAuditEvents()}

## Owner bootstrap

With no root admin in the system, the first sign-in whose email equals
\`BOOTSTRAP_OWNER_EMAIL\` (env, read only by the API composition root) is
promoted to owner exactly once, emitting \`owner.bootstrapped\`. Afterwards
the variable is inert.
`;
};

const main = async (): Promise<void> => {
  const mode = process.argv[2] ?? '--print';
  const next = await renderDocument();

  if (mode === '--write') {
    mkdirSync(path.dirname(DOC_PATH), { recursive: true });
    writeFileSync(DOC_PATH, next);
    process.stdout.write(`written ${path.relative(ROOT, DOC_PATH)}\n`);
    return;
  }
  if (mode === '--check') {
    const current = existsSync(DOC_PATH) ? readFileSync(DOC_PATH, 'utf8') : '';
    if (current !== next) {
      process.stderr.write(
        'docs/business-rules/access.md is stale: the code and its ' +
          'human-readable rules diverged.\nRegenerate and review the diff: ' +
          'pnpm harness rules --write\n',
      );
      process.exit(1);
    }
    process.stdout.write('business rules document is in sync\n');
    return;
  }
  process.stdout.write(next);
};

void main();
