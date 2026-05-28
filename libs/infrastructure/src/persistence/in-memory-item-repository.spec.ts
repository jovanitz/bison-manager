import { createInMemoryItemRepository } from './in-memory-item-repository';
import { itemRepositoryContract } from '../testing/item-repository-contract';

// The in-memory adapter is the reference implementation: it must pass the
// shared contract that defines what *any* ItemRepository means.
itemRepositoryContract('in-memory', () => createInMemoryItemRepository());
