import { describe, expect, it } from 'vitest';
import { parseOperation } from './sync';

const valid = {
  id: 'op_1',
  kind: 'item.save',
  payload: { name: 'Widget' },
  entityId: 'item_1',
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  status: 'pending',
  attempts: 0,
};

describe('parseOperation (drop poison from the outbox)', () => {
  it('accepts a well-formed operation envelope', () => {
    const op = parseOperation(valid);
    expect(op?.id).toBe('op_1');
    expect(op?.kind).toBe('item.save');
  });

  it('drops a malformed envelope by returning null', () => {
    expect(parseOperation({ ...valid, status: 'bogus' })).toBeNull();
    expect(parseOperation({ ...valid, id: '' })).toBeNull();
    expect(parseOperation({ ...valid, version: -1 })).toBeNull();
    expect(parseOperation({ ...valid, attempts: 'x' })).toBeNull();
    expect(parseOperation(undefined)).toBeNull();
  });
});
