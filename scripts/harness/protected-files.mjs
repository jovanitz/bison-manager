/**
 * Project shim over @harness/core's protected-files rules: binds THIS repo's
 * `protectedFiles` list (from harness.config) so the guards keep the same API.
 * Used by BOTH the Claude pre-edit guard and the git pre-commit hook.
 */
import harnessConfig from '../../harness.config.mjs';
import * as core from '../../tools/harness/src/hooks/protected-files.mjs';

export const PROTECTED = harnessConfig.protectedFiles;
export const isProjectJson = core.isProjectJson;
export const isAlwaysProtected = (rel) =>
  core.isAlwaysProtected(rel, PROTECTED);
export const isProtected = (rel) => core.isProtected(rel, PROTECTED);
export const isProtectedChange = (rel, { tracked }) =>
  core.isProtectedChange(rel, { tracked, protectedFiles: PROTECTED });
