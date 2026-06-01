// Design system
export * from './design-system/cn';
export * from './design-system/button';
export * from './design-system/input';
export * from './design-system/card';

// Dependency-injection seam
export * from './di/use-cases-context';

// Runtime introspection bridge (dev-only; guard the call with import.meta.env.DEV)
export * from './debug/debug-bridge';

// Example feature
export * from './example/use-items';
export * from './example/item-form';
export * from './example/item-screen';
