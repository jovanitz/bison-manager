# libs/shared — `layer:shared`

Zero-dependency foundation. **May import nothing** but itself.

- **Holds:** `Result`/`Either`, branded types, clock & logger contracts.
- **Forbidden:** importing any other layer; any framework, browser, DB, HTTP,
  auth or native API.
- **Pattern:** pure functions and types only. No classes, no decorators.

Everyone may import `shared`, so keep it tiny and stable. Rationale:
[ADR-0006](../../docs/adr/0006-shared-foundation-layer.md).
