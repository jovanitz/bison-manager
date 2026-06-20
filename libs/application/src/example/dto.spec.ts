import { describe, expect, it } from 'vitest';
import type { Item } from '@acme/domain';
import { ITEM_DTO_VERSION, parseItemDto, toItemDto } from './dto';

const valid = {
  schemaVersion: ITEM_DTO_VERSION,
  id: 'item_1',
  name: 'Widget',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('parseItemDto (migrate-on-read)', () => {
  it('passes a current, valid record through and stamps the current version', () => {
    const dto = parseItemDto(valid);
    expect(dto?.schemaVersion).toBe(ITEM_DTO_VERSION);
    expect(dto?.id).toBe('item_1');
    expect(dto?.status).toBe('active');
  });

  it('migrates a legacy record with no schemaVersion up to the current version', () => {
    const legacy = {
      id: 'item_1',
      name: 'Widget',
      status: 'archived',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    };
    const dto = parseItemDto(legacy);
    expect(dto?.schemaVersion).toBe(ITEM_DTO_VERSION);
    expect(dto?.status).toBe('archived');
  });

  it('drops a corrupt or unrecoverable record by returning null', () => {
    expect(parseItemDto({ ...valid, id: '' })).toBeNull();
    expect(parseItemDto({ ...valid, status: 'weird' })).toBeNull();
    expect(parseItemDto({ ...valid, name: 123 })).toBeNull();
    expect(parseItemDto(null)).toBeNull();
    expect(parseItemDto('nope')).toBeNull();
  });

  it('accepts what toItemDto writes (round-trip)', () => {
    const item = {
      id: 'item_2',
      name: 'Gadget',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as Item;
    expect(parseItemDto(toItemDto(item))?.id).toBe('item_2');
  });
});
