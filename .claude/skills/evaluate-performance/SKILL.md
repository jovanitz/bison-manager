---
name: evaluate-performance
description: Measure performance of the Acme app — bundle size (raw + gzip, by asset type) of a built app, and micro-benchmarks (ops/sec) of the pure domain/application core. Use after touching hot paths or adding UI, when the user asks "how big is the bundle", "is this fast", "did this regress performance", or wants a perf baseline.
---

# evaluate-performance

Two signals: **bundle size** (what ships) and **benchmarks** (how fast the pure
core runs). The deterministic core makes benchmarks reproducible.

## How to run

```bash
pnpm harness perf                 # build web + measure bundle, then run benchmarks
pnpm harness perf --no-bundle     # benchmarks only (fast; no build)
pnpm harness perf --no-bench      # bundle only
pnpm harness perf --app=web --skip-build   # measure an existing dist build
```

Output is JSON on stdout:

```jsonc
{ "tool":"perf", "ok":true,
  "bundle": {
    "app":"web", "built":true, "outDir":"dist/apps/web",
    "totalBytes":456000, "gzipBytes":145000,
    "byType": { ".js": { "bytes","gzip","files" } },
    "largest": [ { "file","bytes","gzip" } ]
  },
  "bench": { "files": [ { "file", "benchmarks":[ { "name","hz","meanMs","rmePct","p99Ms" } ] } ] } }
```

## How to interpret

- **Bundle:** `gzipBytes` is what users download. `largest` points at the chunks
  to investigate for code-splitting/regressions.
- **Bench:** `hz` = ops/sec (higher is better); `rmePct` = noise (±%) — distrust a
  comparison when rme is large. Compare against a previous run to catch regressions.
- A `skipped: "no *.bench.ts files found"` means add benchmarks — copy the shape of
  `libs/domain/src/example/item.bench.ts`.

## What to do with the result

1. For "did I regress perf?", run before and after and compare `gzipBytes` and `hz`.
2. `--no-bundle` is the fast loop while iterating on domain/application code.
3. Benchmarks only make sense for **pure** functions — keep them in domain/application.

See [docs/ai/sensors.md](../../../docs/ai/sensors.md) for the full tool catalog.
