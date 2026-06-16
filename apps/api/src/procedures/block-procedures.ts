import { z } from 'zod';
import type { AccessBlockUseCases } from '@acme/application';
import { defineApiProcedure } from '../rpc/procedure';
import type { ApiProcedure } from '../rpc/procedure';

const accountInput = z.object({ accountId: z.string().min(1) }).strict();
const accountWithReason = z
  .object({
    accountId: z.string().min(1),
    reason: z.string().min(1).max(500).optional(),
  })
  .strict();
const userInput = z.object({ userId: z.string().min(1) }).strict();
const userWithReason = z
  .object({
    userId: z.string().min(1),
    reason: z.string().min(1).max(500).optional(),
  })
  .strict();
const membershipInput = z.object({ membershipId: z.string().min(1) }).strict();
const membershipWithReason = z
  .object({
    membershipId: z.string().min(1),
    reason: z.string().min(1).max(500).optional(),
  })
  .strict();

/**
 * Soft block: a blocked org/identity keeps signing in but cannot operate (the
 * policy denies every action). All four are gated by `access.block`; the
 * super-admin is protected server-side regardless of the caller's permissions.
 */
export const createBlockProcedures = (
  block: AccessBlockUseCases,
): ReadonlyArray<ApiProcedure> => [
  defineApiProcedure({
    name: 'org.block',
    summary: 'Soft-block a whole org: members can sign in but cannot operate.',
    action: 'access.block',
    input: accountWithReason,
    handler: ({ actor, input }) =>
      block.blockOrg({
        actor,
        accountId: input.accountId,
        ...(input.reason === undefined ? {} : { reason: input.reason }),
      }),
  }),
  defineApiProcedure({
    name: 'org.unblock',
    summary: 'Lift an org soft-block.',
    action: 'access.block',
    input: accountInput,
    handler: ({ actor, input }) =>
      block.unblockOrg({ actor, accountId: input.accountId }),
  }),
  defineApiProcedure({
    name: 'identity.block',
    summary:
      'Soft-block an identity across every org: can sign in, cannot operate.',
    action: 'access.block',
    input: userWithReason,
    handler: ({ actor, input }) =>
      block.blockIdentity({
        actor,
        userId: input.userId,
        ...(input.reason === undefined ? {} : { reason: input.reason }),
      }),
  }),
  defineApiProcedure({
    name: 'identity.unblock',
    summary: 'Lift an identity soft-block.',
    action: 'access.block',
    input: userInput,
    handler: ({ actor, input }) =>
      block.unblockIdentity({ actor, userId: input.userId }),
  }),
  defineApiProcedure({
    name: 'members.block',
    summary:
      'Org admin soft-block of one member inside their OWN org (own scope): ' +
      'the member can sign in but cannot operate in that org.',
    action: 'members.block',
    input: membershipWithReason,
    handler: ({ actor, input }) =>
      block.blockMember({
        actor,
        membershipId: input.membershipId,
        ...(input.reason === undefined ? {} : { reason: input.reason }),
      }),
  }),
  defineApiProcedure({
    name: 'members.unblock',
    summary: 'Lift a member soft-block within your org.',
    action: 'members.block',
    input: membershipInput,
    handler: ({ actor, input }) =>
      block.unblockMember({ actor, membershipId: input.membershipId }),
  }),
];
