/**
 * @harness/core — protected-files rules (pure, project-agnostic).
 *
 * The consuming repo supplies its own `protectedFiles` list (from
 * harness.config). These functions encode the rule shared by the Claude
 * pre-edit guard and the git pre-commit hook so it can't drift between them.
 */

/** One of the always-protected, harness-defining files. */
export const isAlwaysProtected = (rel, protectedFiles) =>
  protectedFiles.includes(rel);

/** Any Nx `project.json` (its `tags` drive layer-boundary enforcement). */
export const isProjectJson = (rel) => /(^|\/)project\.json$/.test(rel);

/**
 * Path-only check (no git context): true for the fixed files and ANY
 * project.json. Prefer `isProtectedChange` where existence is known.
 */
export const isProtected = (rel, protectedFiles) =>
  isAlwaysProtected(rel, protectedFiles) || isProjectJson(rel);

/**
 * The precise rule given whether the path already exists in the repo:
 * fixed files are always protected; an EXISTING project.json is protected
 * (tamper guard), but a NEW one may be added (scaffolding a new app/lib).
 */
export const isProtectedChange = (rel, { tracked, protectedFiles }) =>
  isAlwaysProtected(rel, protectedFiles) || (isProjectJson(rel) && tracked);
