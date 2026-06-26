import { z } from 'zod';

/** Zod input schemas for the dashboard flow registry (kept out of registry.ts
 * so the catalog itself stays under the file-length budget). */
export const empty = z.object({});
export const grantInput = z.object({
  accountId: z.string(),
  membershipId: z.string(),
  action: z.string(),
  scope: z.string(),
});
export const inviteInput = z.object({
  accountId: z.string(),
  email: z.string().email(),
});
export const blockInput = z.object({
  subject: z.enum(['org', 'identity']),
  id: z.string(),
  blocked: z.boolean(),
});
const permissionsInput = z.array(
  z.object({ action: z.string(), scope: z.string() }),
);
export const createRoleInput = z.object({
  name: z.string(),
  permissions: permissionsInput,
});
export const updateRoleInput = z.object({
  roleId: z.string(),
  name: z.string(),
  permissions: permissionsInput,
});
export const deleteRoleInput = z.object({ roleId: z.string() });
export const assignRolesInput = z.object({
  membershipId: z.string(),
  roleIds: z.array(z.string()),
});
export const updateTemplateInput = z.object({
  key: z.string(),
  name: z.string(),
  permissions: permissionsInput,
});
export const resetTemplateInput = z.object({ key: z.string() });
export const adminAccountInput = z.object({
  action: z.enum(['disable', 'enable', 'promote']),
  accountId: z.string(),
  reason: z.string().optional(),
});
export const membershipInput = z.object({ membershipId: z.string() });
export const sessionIdInput = z.object({ sessionId: z.string() });
const sessionPolicyShape = z.object({
  idleTtlMs: z.number().int().positive(),
  maxLifetimeMs: z.number().int().positive(),
});
export const sessionPolicyInput = z.object({
  policies: z.object({
    customer: sessionPolicyShape,
    staff: sessionPolicyShape,
  }),
});
