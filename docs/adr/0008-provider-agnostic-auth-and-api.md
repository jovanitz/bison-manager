# ADR-0008: Provider-agnostic auth and API behind ports

- Status: Accepted
- Date: 2026-06-05

## Context

Products will use different identity providers (Cognito, Auth0, Clerk, custom
JWT) and different API protocols (REST, GraphQL, AppSync, tRPC). None of this
should leak into business logic.

## Decision

- Define an **`AuthProvider`** port in `application` (`getSession`, `signIn`,
  `getAccessToken`, `onChange`, …). Each identity provider is an adapter in
  `infrastructure/auth` exposing that exact shape. `createJwtAuthProvider` ships
  as the reference; Cognito/Auth0/Clerk are sibling factories.
- Define an **`ApiClient`** port (`request(ApiRequest) → Result<T, ApiError>`).
  REST (`createHttpApiClient`) ships as the reference; GraphQL/AppSync/tRPC
  adapters implement the same port. Repositories (`createApiItemRepository`) are
  written against the port, so the protocol is invisible to them.

## Consequences

- Switching providers is a one-line composition-root change; use cases, UI and
  domain are untouched.
- Token attachment is centralized: the REST client pulls a bearer token from the
  injected `AuthProvider`, so "REST over Cognito" and "REST over Auth0" are the
  same code.
- Each new adapter should pass the relevant contract test to guarantee
  interchangeability.
