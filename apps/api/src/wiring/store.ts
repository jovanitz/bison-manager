import type { createInMemoryAccessStore } from '@acme/infrastructure';
import type { createPostgresAccessStore } from '@acme/infrastructure-node';

/**
 * Whichever access store the composition root chose. Both satisfy the same
 * ports; only `close` differs (the pool drain has nothing to do in memory).
 */
export type AccessStore =
  | (ReturnType<typeof createInMemoryAccessStore> & {
      readonly close: undefined;
    })
  | ReturnType<typeof createPostgresAccessStore>;
