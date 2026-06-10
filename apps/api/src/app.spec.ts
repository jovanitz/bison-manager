import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './app';
import { createApiRuntime } from './composition-root';

const app = () => createApiRuntime({ seed: {} }).app;

describe('GET /health', () => {
  it('responds 200 with a payload matching the health schema', async () => {
    const res = await app().request('/health');

    expect(res.status).toBe(200);
    const body = healthResponseSchema.parse(await res.json());
    expect(body.status).toBe('ok');
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('returns 404 for unknown routes', async () => {
    const res = await app().request('/nope');

    expect(res.status).toBe(404);
  });
});
