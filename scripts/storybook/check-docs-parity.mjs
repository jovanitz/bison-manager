#!/usr/bin/env node
// @ts-check
/**
 * Storybook Docs ↔ Canvas parity check.
 *
 * The component (Canvas / story view) is the source of truth. The autodocs page
 * must render each component identically — Storybook's own page styling (and our
 * dark-mode docs overrides in `.storybook/storybook.css`) must never leak into a
 * component preview. This script proves that for every Design System component,
 * in both light and dark, by diffing computed `background/color/border` of each
 * element (matched by tag + className) between the Canvas and the Docs preview.
 *
 * Requires a running Storybook (default http://127.0.0.1:6006). Usage:
 *   pnpm storybook            # in one terminal
 *   pnpm storybook:check      # in another  (or: node scripts/storybook/check-docs-parity.mjs)
 *   node scripts/storybook/check-docs-parity.mjs --url=http://127.0.0.1:6006 --mode=both
 *
 * Exit codes: 0 = parity, 1 = divergence found, 2 = Storybook unreachable.
 */
import { chromium } from '@playwright/test';

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const BASE = (
  process.env.STORYBOOK_URL || arg('url', 'http://127.0.0.1:6006')
).replace(/\/$/, '');
const MODE = arg('mode', 'both'); // dark | light | both
const TITLE_PREFIX = arg('prefix', 'Design System/');
const MODES = MODE === 'both' ? ['light', 'dark'] : [MODE];

/** Collect tag+class → "bg~color~border" for every element under a root, after
 * forcing the theme class. Runs in the page; getComputedStyle forces a sync
 * style recalc so the toggled class is reflected immediately. */
const collect = ({ rootSel, dark }) => {
  document.documentElement.classList.toggle('dark', dark);
  const root = document.querySelector(rootSel);
  if (!root) return null;
  /** @type {Record<string,string>} */
  const map = {};
  for (const el of root.querySelectorAll('*')) {
    const key = el.tagName + '|' + (el.className?.toString?.() || '');
    if (key in map) continue;
    const cs = getComputedStyle(el);
    map[key] = `${cs.backgroundColor}~${cs.color}~${cs.borderColor}`;
  }
  return map;
};

const fetchComponents = async () => {
  const res = await fetch(`${BASE}/index.json`);
  if (!res.ok) throw new Error(`index.json ${res.status}`);
  const json = await res.json();
  const entries = Object.values(json.entries || json.stories || {});
  /** @type {Record<string,{story?:string,docs?:string}>} */
  const byComp = {};
  for (const e of entries) {
    if (!e.title?.startsWith(TITLE_PREFIX)) continue;
    const k = (byComp[e.title] ||= {});
    if (e.type === 'docs') k.docs ||= e.id;
    if (e.type === 'story') k.story ||= e.id;
  }
  return Object.entries(byComp)
    .filter(([, v]) => v.story && v.docs)
    .map(([title, v]) => ({ name: title.slice(TITLE_PREFIX.length), ...v }));
};

const mapForFrame = async (page, url, rootSel, dark) => {
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector(rootSel, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(250);
  return page.evaluate(collect, { rootSel, dark });
};

const diff = (canvas, docs) => {
  if (!canvas || !docs)
    return [{ el: '(missing render)', canvas: !!canvas, docs: !!docs }];
  const out = [];
  for (const key of Object.keys(canvas)) {
    if (key in docs && canvas[key] !== docs[key]) {
      out.push({
        el: key.split('|')[0] + ' .' + (key.split('|')[1] || '').slice(0, 40),
        canvas: canvas[key],
        docs: docs[key],
      });
    }
  }
  return out;
};

const main = async () => {
  let components;
  try {
    components = await fetchComponents();
  } catch (err) {
    console.error(
      `✗ Cannot reach Storybook at ${BASE} (${err.message}). Start it with: pnpm storybook`,
    );
    process.exit(2);
  }
  if (components.length === 0) {
    console.error(`✗ No components found under "${TITLE_PREFIX}" at ${BASE}`);
    process.exit(2);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1100, height: 800 },
  });
  let failures = 0;

  console.log(`Docs↔Canvas parity · ${BASE} · modes: ${MODES.join(', ')}\n`);
  for (const mode of MODES) {
    const dark = mode === 'dark';
    console.log(`── ${mode} ──`);
    for (const c of components) {
      const canvas = await mapForFrame(
        page,
        `${BASE}/iframe.html?id=${c.story}&viewMode=story`,
        '#storybook-root',
        dark,
      );
      const docs = await mapForFrame(
        page,
        `${BASE}/iframe.html?id=${c.docs}&viewMode=docs`,
        '.docs-story',
        dark,
      );
      const diffs = diff(canvas, docs);
      const n = canvas ? Object.keys(canvas).length : 0;
      if (diffs.length === 0) {
        console.log(`  ✓ ${c.name.padEnd(14)} ${n} elements`);
      } else {
        failures += diffs.length;
        console.log(`  ✗ ${c.name.padEnd(14)} ${diffs.length} divergence(s):`);
        for (const d of diffs.slice(0, 6)) {
          console.log(
            `      ${d.el}\n        canvas: ${d.canvas}\n        docs:   ${d.docs}`,
          );
        }
      }
    }
    console.log('');
  }

  await browser.close();
  if (failures > 0) {
    console.error(
      `✗ ${failures} divergence(s) found — Docs is diverging from the component (source of truth).`,
    );
    process.exit(1);
  }
  console.log('✓ All components render identically in Docs and Canvas.');
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
