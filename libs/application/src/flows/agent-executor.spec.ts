import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { fixedClock, ok } from '@acme/shared';
import type { FlowCommand } from './registry-types';
import {
  type AgentAuditEvent,
  readOnlyAgentTools,
  runAuditedAgentFlow,
  runReadOnlyAgentFlow,
} from './agent-executor';
import { DASHBOARD_FLOWS } from './dashboard/registry';

type Deps = { readonly actor: string };

const build = () => {
  const sideEffects: string[] = [];
  const seen: unknown[] = [];
  const registry: ReadonlyArray<FlowCommand<Deps>> = [
    {
      name: 'things.list',
      kind: 'query',
      description: 'List the things visible to the actor.',
      input: z.object({ q: z.string() }),
      run: async (deps, input) => {
        seen.push({ deps, input });
        return ok(['a', 'b']);
      },
    },
    {
      name: 'things.delete',
      kind: 'command',
      description: 'Delete a thing (mutation).',
      input: z.object({ id: z.string() }),
      run: async () => {
        sideEffects.push('DELETED'); // must NEVER run under the read-only executor
        return ok(undefined);
      },
    },
  ];
  return { registry, sideEffects, seen };
};

const deps: Deps = { actor: 'user-1' };

describe('runReadOnlyAgentFlow', () => {
  it('runs a query with validated args + the caller deps, returning its result', async () => {
    const { registry, seen } = build();
    const r = await runReadOnlyAgentFlow(registry, deps, {
      name: 'things.list',
      input: { q: 'north' },
    });
    expect(r).toEqual({ ok: true, value: ['a', 'b'] });
    // the flow saw the END USER's deps (it authorizes as them) + parsed args
    expect(seen).toEqual([{ deps, input: { q: 'north' } }]);
  });

  it('REFUSES a command even when the model names one — before any dep is touched', async () => {
    const { registry, sideEffects } = build();
    const r = await runReadOnlyAgentFlow(registry, deps, {
      name: 'things.delete',
      input: { id: 'x' },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('agent/not-read-only');
    expect(sideEffects).toEqual([]); // the mutation never ran
  });

  it('refuses an unknown tool the model invented', async () => {
    const { registry } = build();
    const r = await runReadOnlyAgentFlow(registry, deps, {
      name: 'things.wipe',
      input: {},
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('agent/unknown-tool');
  });

  it('refuses malformed args before running the flow', async () => {
    const { registry, seen } = build();
    const r = await runReadOnlyAgentFlow(registry, deps, {
      name: 'things.list',
      input: { q: 123 }, // wrong type
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('agent/invalid-input');
    expect(seen).toEqual([]); // never reached the flow
  });
});

describe('readOnlyAgentTools', () => {
  it('exposes ONLY query flows (deny-by-default: no mutations discoverable)', () => {
    const { registry } = build();
    const tools = readOnlyAgentTools(registry);
    expect(tools.map((t) => t.name)).toEqual(['things.list']);
    expect(tools.every((t) => t.kind === 'query')).toBe(true);
  });

  it('over the REAL dashboard registry: surfaces reads, hides every mutation', () => {
    const names = readOnlyAgentTools(DASHBOARD_FLOWS).map((t) => t.name);
    // reads a customer-support agent could safely run
    expect(names).toContain('dashboard.load');
    expect(names).toContain('org.detail.load');
    // the dangerous mutations the audit cared about are NOT discoverable
    for (const mutation of [
      'staff.invite',
      'staff.members.grant',
      'roles.assign',
      'roles.create',
    ]) {
      expect(names).not.toContain(mutation);
    }
  });

  it('over the REAL dashboard registry: refuses to RUN a mutation by name', async () => {
    const r = await runReadOnlyAgentFlow(DASHBOARD_FLOWS, {} as never, {
      name: 'staff.invite',
      input: { email: 'x@y.z' },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('agent/not-read-only');
  });
});

describe('runAuditedAgentFlow', () => {
  const ctx = (log: AgentAuditEvent[]) => ({
    audit: { record: async (e: AgentAuditEvent) => void log.push(e) },
    clock: fixedClock(new Date('2026-07-18T12:00:00.000Z')),
    actorRef: 'membership-42',
  });

  it('records a tool that RAN (actor + tool + when), result unchanged', async () => {
    const { registry } = build();
    const log: AgentAuditEvent[] = [];
    const r = await runAuditedAgentFlow(ctx(log), registry, deps, {
      name: 'things.list',
      input: { q: 'north' },
    });
    expect(r).toEqual({ ok: true, value: ['a', 'b'] });
    expect(log).toEqual([
      {
        actorRef: 'membership-42',
        tool: 'things.list',
        outcome: 'ran',
        reason: null,
        occurredAt: '2026-07-18T12:00:00.000Z',
      },
    ]);
  });

  it('records a REFUSED mutation attempt — a hijack try is visible after the fact', async () => {
    const { registry, sideEffects } = build();
    const log: AgentAuditEvent[] = [];
    const r = await runAuditedAgentFlow(ctx(log), registry, deps, {
      name: 'things.delete',
      input: { id: 'x' },
    });
    expect(r.ok).toBe(false);
    expect(sideEffects).toEqual([]); // still never ran
    expect(log[0]).toMatchObject({
      tool: 'things.delete',
      outcome: 'refused',
      reason: 'agent/not-read-only',
    });
  });
});
