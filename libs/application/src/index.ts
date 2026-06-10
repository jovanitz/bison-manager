// Ports (abstractions the outside world must satisfy)
export * from './ports/event-publisher';
export * from './ports/auth';
export * from './ports/api';
export * from './ports/sync';
export * from './ports/list-options';

// Example module: DTOs, ports, use cases, errors
export * from './example/dto';
export * from './example/ports';
export * from './example/errors';
export * from './example/use-cases';

// Access module: authorization core orchestration
export * from './access/dto';
export * from './access/ports';
export * from './access/errors';
export * from './access/authorize';
export * from './access/use-cases';

// Access administration: disable accounts, edit permissions, revoke sessions
export * from './access-admin/ports';
export * from './access-admin/errors';
export * from './access-admin/use-cases';

// Impersonation: support's temporary, view-only customer access
export * from './impersonation/ports';
export * from './impersonation/errors';
export * from './impersonation/use-cases';
export * from './impersonation/customer-use-cases';

// Audit trail: append-only security event log
export * from './audit-trail/ports';
export * from './audit-trail/use-cases';
