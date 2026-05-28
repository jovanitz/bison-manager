import { describe, expect, it } from 'vitest';
import { createFakePlatform } from './fake-platform';

describe('fake platform', () => {
  it('reports and toggles online state, notifying subscribers', async () => {
    const platform = createFakePlatform({ online: true });
    const seen: boolean[] = [];
    platform.network.subscribe((s) => seen.push(s.online));

    expect((await platform.network.current()).online).toBe(true);
    platform.setOnline(false);
    expect((await platform.network.current()).online).toBe(false);
    expect(seen).toEqual([false]);
  });

  it('round-trips secure storage', async () => {
    const platform = createFakePlatform();
    await platform.secureStorage.set('token', 'abc');
    expect(await platform.secureStorage.get('token')).toBe('abc');
    await platform.secureStorage.remove('token');
    expect(await platform.secureStorage.get('token')).toBeNull();
  });
});
