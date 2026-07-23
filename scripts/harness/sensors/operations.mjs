#!/usr/bin/env node
/**
 * Harness sensor — `operations`.
 *
 * Enforces the CALLER-AGNOSTIC operations policy (docs/ai/operations.md): a
 * mutating operation is indifferent to who calls it — a human via the UI or an
 * AI via a prompt — because its logic, authorization and AUDIT live in the flow
 * contract, not in the adapter. The load-bearing corollary the harness checks:
 * the audited *intent* of a mutation — its `reason` — is a REQUIRED field of the
 * operation's input contract, and no caller (UI / adapter) may ORIGINATE it.
 *
 * Two rules:
 *   A — no synthesized reasons in callers. In libs/ui + the client apps, a
 *       `reason:` assigned a STRING LITERAL is a violation: the reason must be a
 *       real caller argument (a human's field, an agent's prompt-derived value),
 *       never a hardcoded constant baked into the UI. This is the direct guard
 *       against "reason: 'Retired via console'" — the coupling that would break
 *       the day an AI (which never passes through the UI) drives the same flow.
 *   C — reason-bearing contract. In the flow input schemas, a Zod `reason` field
 *       must be `z.string().min(1)` and NOT `.optional()` — required + non-empty,
 *       so the audit can never be silently loosened to reason-less.
 *
 * Escape hatches (rare, self-documenting — put on the offending line):
 *   // harness:reason-literal-ok <why>    (Rule A — a non-audit `reason` field)
 *   // harness:reason-optional-ok <why>   (Rule C — a lever whose reason is
 *                                          optional by deliberate design)
 *
 * Line-based (fast, zero-dep). A Zod `reason` chain that spans multiple lines is
 * not analyzed — the repo writes them on one line. Prints JSON; exit 1 on any
 * high-severity violation (the Stop guardrail blocks on it).
 * Usage: node scripts/harness/sensors/operations.mjs [--root=<dir>]
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import harnessConfig from '../../../harness.config.mjs';

const cfg = harnessConfig.operations ?? {};
const REASON_SCAN = cfg.reasonScan ?? ['libs/ui/src', 'apps'];
const REASON_SCAN_EXCLUDE = cfg.reasonScanExclude ?? ['apps/api'];
const SCHEMA_SCAN = cfg.reasonSchemaScan ?? ['libs/application/src/flows'];

const args = process.argv.slice(2);
const getArg = (n) => {
  const hit = args.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : undefined;
};
const ROOT = path.resolve(getArg('root') || process.cwd());
const IGNORE_DIR = new Set(['node_modules', 'dist', '.nx', 'coverage']);
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');

/** Test / demo / prototype files author `reason`s legitimately — skip them. */
const NON_PRODUCTION = /(\.(spec|test|stories|fixtures|e2e)\.)|\/prototype\//;

const collect = (dir, pred) => {
  const out = [];
  const walk = (d) => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d)) {
      if (IGNORE_DIR.has(e)) continue;
      const full = path.join(d, e);
      if (statSync(full).isDirectory()) walk(full);
      else if (pred(full)) out.push(full);
    }
  };
  walk(dir);
  return out;
};

const violations = [];
const add = (rule, file, line, detail) =>
  violations.push({ severity: 'high', rule, path: file, line, detail });

// ── Rule A — no synthesized reasons in the UI / client adapters ──────────────
// A `reason` object-property assigned a quoted string literal. Word-boundary so
// `internalReason`/`foo_reason` don't match; a type annotation (`reason: string`)
// has no quote, so it never matches.
const REASON_LITERAL = /(?<![A-Za-z0-9_])reason\s*:\s*['"]/;
const excluded = (r) =>
  REASON_SCAN_EXCLUDE.some((x) => r === x || r.startsWith(`${x}/`));
const isSource = (f) => /\.(ts|tsx)$/.test(f) && !NON_PRODUCTION.test(rel(f));

const ruleAFiles = REASON_SCAN.flatMap((d) =>
  collect(path.join(ROOT, d), isSource),
).filter((f) => !excluded(rel(f)));

let ruleAScanned = 0;
for (const full of ruleAFiles) {
  ruleAScanned += 1;
  const lines = readFileSync(full, 'utf8').split('\n');
  lines.forEach((text, i) => {
    if (!REASON_LITERAL.test(text)) return;
    if (text.includes('harness:reason-literal-ok')) return;
    add(
      'no-synthesized-reason',
      rel(full),
      i + 1,
      "A caller must not ORIGINATE an audited `reason` — this hardcodes it. Pass the reason from a real argument (a human's field / an agent's prompt). If this is not an audited operation's reason, mark the line `// harness:reason-literal-ok <why>`.",
    );
  });
}

// ── Rule C — the flow contract's `reason` is required + non-empty ────────────
// A Zod `reason` field/const on one line. Shorthand (`reason,`) and identifier
// references (`reason: reasonSchema`) point at a checked const, so they're skipped
// — only inline `z.` chains and the shared `const reason = z.…` are inspected.
const REASON_ZOD = /(?<![A-Za-z0-9_])reason\s*[:=]\s*z\./;
const schemaFiles = SCHEMA_SCAN.flatMap((d) =>
  collect(
    path.join(ROOT, d),
    (f) => f.endsWith('.ts') && !/\.spec\.ts$/.test(f),
  ),
);

let ruleCScanned = 0;
for (const full of schemaFiles) {
  ruleCScanned += 1;
  const lines = readFileSync(full, 'utf8').split('\n');
  lines.forEach((text, i) => {
    if (!REASON_ZOD.test(text)) return;
    if (text.includes('harness:reason-optional-ok')) return;
    if (/\.optional\s*\(/.test(text)) {
      add(
        'reason-must-be-required',
        rel(full),
        i + 1,
        'An audited operation’s `reason` must be required, not `.optional()` — a caller could omit it and leave the audit blank. Drop `.optional()` (use the shared `reason` schema). If a lever is deliberately reason-optional, mark the line `// harness:reason-optional-ok <why>`.',
      );
    } else if (!/\.min\s*\(\s*1/.test(text)) {
      add(
        'reason-must-be-nonempty',
        rel(full),
        i + 1,
        'An audited `reason` must reject the empty string — add `.min(1)` (or use the shared `reason` schema).',
      );
    }
  });
}

const high = violations.length;
process.stdout.write(
  JSON.stringify(
    {
      tool: 'operations',
      generatedAt: new Date().toISOString(),
      ok: high === 0,
      summary: {
        callerFilesScanned: ruleAScanned,
        schemaFilesScanned: ruleCScanned,
        violations: high,
      },
      violations,
    },
    null,
    2,
  ) + '\n',
);
process.exitCode = high ? 1 : 0;
