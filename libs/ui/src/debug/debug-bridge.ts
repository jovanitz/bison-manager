import type { QueryClient } from '@tanstack/react-query';
import type { AppUseCases } from '../di/use-cases-context';

/**
 * Runtime introspection bridge (DEV ONLY).
 *
 * Publishes a live, structured view of the app's internals on `globalThis.__app__`
 * so any browser driver — Playwright `page.evaluate`, Claude Preview `preview_eval`,
 * or the Claude Chrome extension — can verify behaviour *as a user would* AND read
 * the internal data, states and errors at runtime (the part the DOM can't show).
 *
 * It only observes; it never mutates app state. The caller must guard it behind
 * `import.meta.env.DEV` so it is tree-shaken out of production.
 */

const RING = 50; // keep the last N events/errors

export type RuntimeRecord = {
  readonly at: string;
  readonly kind: 'event' | 'error';
  readonly payload: unknown;
};

export type RuntimeSnapshot = {
  readonly capturedAt: string;
  readonly useCases: ReadonlyArray<string>;
  readonly queries: ReadonlyArray<{
    readonly key: unknown;
    readonly status: string;
    readonly fetchStatus: string;
    readonly error: string | null;
    readonly updatedAt: number;
  }>;
  readonly events: ReadonlyArray<RuntimeRecord>;
  readonly errors: ReadonlyArray<RuntimeRecord>;
};

export type DebugBridge = {
  /** Append a domain event or error to its ring buffer. */
  readonly record: (kind: 'event' | 'error', payload: unknown) => void;
  /** A structured, JSON-safe view of the current runtime state. */
  readonly snapshot: () => RuntimeSnapshot;
};

type Target = Record<string, unknown>;

const readQueries = (queryClient: QueryClient): RuntimeSnapshot['queries'] => {
  try {
    return queryClient
      .getQueryCache()
      .getAll()
      .map((q) => ({
        key: q.queryKey,
        status: q.state.status,
        fetchStatus: q.state.fetchStatus,
        error: q.state.error ? String(q.state.error) : null,
        updatedAt: q.state.dataUpdatedAt,
      }));
  } catch {
    return [];
  }
};

/**
 * Build the bridge and install it on `target` (default `globalThis`). The target
 * is injectable so it can be unit-tested without a real window.
 */
export const installDebugBridge = (
  deps: { queryClient: QueryClient; useCases: AppUseCases },
  target: Target = globalThis as unknown as Target,
): DebugBridge => {
  const events: RuntimeRecord[] = [];
  const errors: RuntimeRecord[] = [];

  const record: DebugBridge['record'] = (kind, payload) => {
    const buf = kind === 'event' ? events : errors;
    buf.push({ at: new Date().toISOString(), kind, payload });
    if (buf.length > RING) buf.shift();
  };

  const bridge: DebugBridge = {
    record,
    snapshot: () => ({
      capturedAt: new Date().toISOString(),
      useCases: Object.keys(deps.useCases),
      queries: readQueries(deps.queryClient),
      events: [...events],
      errors: [...errors],
    }),
  };

  // Capture uncaught runtime errors so they show up in the snapshot.
  const onError = (e: unknown) =>
    record('error', e instanceof Error ? `${e.name}: ${e.message}` : String(e));
  const addListener = (target as { addEventListener?: unknown })
    .addEventListener;
  if (typeof addListener === 'function') {
    const add = addListener as (t: string, cb: (ev: unknown) => void) => void;
    add('error', (ev) => onError((ev as { error?: unknown })?.error ?? ev));
    add('unhandledrejection', (ev) =>
      onError((ev as { reason?: unknown })?.reason),
    );
  }

  target['__app__'] = bridge;
  return bridge;
};
