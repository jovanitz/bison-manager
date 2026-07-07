# apps/app-b — the per-giro instantiation template

This is the **living template for standing up a new giro** (isolated product —
[ADR-0017](../../docs/adr/0017-giro-isolation.md)): a second consumer of the
shared access engine with its **own `AccessConfig` vocabulary**
([src/access.ts](src/access.ts)), proving the engine is injectable and that a
giro's world is instantiated, never shared.

To create giro B, copy THIS shape — not `apps/api` wholesale (that would drag
the existing giro's vocabulary, seeds and procedures with it):

1. New auth+DB project (own Supabase project: own users, own migrations dir).
2. New thin API app + composition root pointing at that project.
3. Its own `AccessConfig` vocabulary + role/plan seeds.
4. Its UIs under `libs/ui/src/<giro>/…` (see docs/ai/screens.md).

Name new giro apps `<giro>-<app>` (e.g. `girob-api`, `girob-dashboard`) —
unqualified names (`api`, `dashboard`, `client`, `web`) are legacy names owned
by the existing giro.
