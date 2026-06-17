/**
 * @harness/core — post-edit runner (format + lint a single touched file).
 *
 * Project-agnostic: the consuming repo passes its `sourceRoots` (which path
 * prefixes are lintable source). Returns `{ blocked, message }`; the shim turns
 * a block into exit 2 so the model gets the lint/boundary error immediately.
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const FORMAT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|css|html)$/;
const LINT_EXT = /\.(ts|tsx|js|jsx)$/;

export const runPostEdit = ({
  cwd,
  filePath,
  sourceRoots = ['libs/', 'apps/'],
}) => {
  const abs = path.resolve(cwd, filePath);
  if (!existsSync(abs)) return { blocked: false }; // deleted / moved
  const rel = path.relative(cwd, abs).split(path.sep).join('/');
  const bin = (name) => path.join(cwd, 'node_modules', '.bin', name);

  // 1) Format (best-effort; never blocks on a formatting hiccup).
  if (FORMAT_EXT.test(rel) && existsSync(bin('prettier'))) {
    spawnSync(bin('prettier'), ['--write', abs], { cwd, encoding: 'utf8' });
  }

  // 2) Lint the single file (boundary rules apply per-file). Blocks on failure.
  const inSource = sourceRoots.some((r) => rel.startsWith(r));
  if (inSource && LINT_EXT.test(rel) && existsSync(bin('eslint'))) {
    const res = spawnSync(bin('eslint'), [abs], { cwd, encoding: 'utf8' });
    if (res.status && res.status !== 0) {
      const out = `${res.stdout || ''}${res.stderr || ''}`
        .trim()
        .slice(0, 4000);
      return {
        blocked: true,
        message:
          `Lint failed for "${rel}" (this includes layer-boundary violations). ` +
          `Fix before continuing:\n\n${out}`,
      };
    }
  }
  return { blocked: false };
};
