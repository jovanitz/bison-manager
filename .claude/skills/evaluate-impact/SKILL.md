---
name: evaluate-impact
description: Report the blast radius of a code change in the Acme monorepo — which projects and platforms are affected and how deep (risk). Use before a risky refactor, when scoping what to test/review, when the user asks "what does this affect", "what's the impact", "what could this break", or to assess a PR's reach.
---

# evaluate-impact

Wraps `nx affected` to show what a change reaches. Use it to scope testing and
review: only the affected projects need re-checking.

## How to run

```bash
pnpm harness impact                       # impact of current working-tree changes
pnpm harness impact --base=main --head=HEAD   # impact of a commit range / PR
```

Output is JSON on stdout:

```jsonc
{ "tool":"impact", "ok":true,
  "range":"working-tree-vs-nx-base",
  "summary": {
    "affectedCount": 7,
    "platformsAffected": ["web","mobile","desktop"],
    "byLayer": { "domain":1, "application":1, "infrastructure":1, "ui":1, "app":3 },
    "riskHint": "high"
  },
  "affected": [ { "project","layer","type" } ] }
```

## How to interpret

- **`riskHint`** is driven by the deepest affected layer (not platform count — all
  apps share the web build here, so almost any lib hits all three):
  - `high` → a foundational layer (`shared`/`domain`/`application`) changed. Wide,
    business-critical reach: run the full affected suite and review carefully.
  - `medium` → an outer lib (`infrastructure`/`platform`/`ui`) changed.
  - `low` → only apps (composition roots) or nothing changed.
- **`affected`** is exactly the set you should lint/typecheck/test. Pair with the
  quality gate (`nx affected -t lint typecheck test`).

## What to do with the result

1. Report `affectedCount`, `riskHint`, and the platforms before making changes the
   user called "risky".
2. Use `affected` to target tests/review rather than running everything.

See [docs/ai/sensors.md](../../../docs/ai/sensors.md) for the full tool catalog.
