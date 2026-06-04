/**
 * The single source of truth for files the harness protects from edits.
 * Used by BOTH the Claude pre-edit guard and the git pre-commit hook, so the
 * rule is identical no matter which agent (or a human) is at the keyboard.
 */
export const PROTECTED = [
  'eslint.config.mjs',
  'docs/ai/capabilities.json',
  'nx.json',
  'tsconfig.base.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  '.claude/settings.json',
];

/** A repo-relative path (posix separators) is protected? */
export const isProtected = (rel) =>
  PROTECTED.includes(rel) || /(^|\/)project\.json$/.test(rel);
