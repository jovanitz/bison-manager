import { z } from 'zod';
import type {
  AccessInvitationsUseCases,
  AccessMembersUseCases,
} from '@acme/application';
import { defineApiProcedure } from '../../rpc/procedure';
import type { ApiProcedure } from '../../rpc/procedure';

const membersInvite = (
  accessInvitations: AccessInvitationsUseCases,
): ApiProcedure =>
  defineApiProcedure({
    name: 'members.invite',
    summary:
      'Invite an email into an existing account with explicit permissions ' +
      'and/or roles; the invited identity joins on its first login (7-day ' +
      'expiry).',
    action: 'members.invite',
    input: z
      .object({
        accountId: z.string().min(1),
        email: z.string().min(3).max(320),
        permissions: z
          .array(
            z
              .object({
                action: z.string().min(1),
                scope: z.string().min(1),
              })
              .strict(),
          )
          .max(50),
        roleIds: z.array(z.string().min(1)).max(50).optional(),
      })
      .strict(),
    handler: ({ actor, input }) =>
      accessInvitations.createInvitation({
        actor,
        accountId: input.accountId,
        email: input.email,
        permissions: input.permissions,
        ...(input.roleIds ? { roleIds: input.roleIds } : {}),
      }),
  });

/** Self-service multi-organization endpoints (no permission, only identity). */
const membershipProcedures = (
  accessMembers: AccessMembersUseCases,
): ReadonlyArray<ApiProcedure> => [
  defineApiProcedure({
    name: 'memberships.mine',
    summary:
      "The caller's own organizations — feeds the organization switcher.",
    action: null, // self-service: your own memberships only
    input: z.object({}).strict(),
    handler: ({ actor }) => accessMembers.listMyMemberships({ actor }),
  }),
  defineApiProcedure({
    name: 'session.switch-account',
    summary:
      'Re-bind the current session to ANOTHER of your own memberships; ' +
      "expiry is recomputed under the target account's policy.",
    action: null, // structural: the target membership must be yours
    input: z.object({ membershipId: z.string().min(1) }).strict(),
    handler: ({ actor, input }) =>
      accessMembers.switchAccount({ actor, membershipId: input.membershipId }),
  }),
];

export const createMembersProcedures = (
  accessInvitations: AccessInvitationsUseCases,
  accessMembers: AccessMembersUseCases,
): ReadonlyArray<ApiProcedure> => [
  defineApiProcedure({
    name: 'members.list',
    summary:
      "An account's memberships with their permissions — the organization " +
      'members view (own account for org admins, any for platform staff).',
    action: 'members.read',
    input: z.object({ accountId: z.string().min(1) }).strict(),
    handler: ({ actor, input }) =>
      accessMembers.listMembers({ actor, accountId: input.accountId }),
  }),
  defineApiProcedure({
    name: 'members.remove',
    summary:
      'Remove a member from their account; their sessions die in the same ' +
      'transaction. Never your own membership.',
    action: 'members.remove',
    input: z.object({ membershipId: z.string().min(1) }).strict(),
    handler: ({ actor, input }) =>
      accessMembers.removeMember({ actor, membershipId: input.membershipId }),
  }),
  membersInvite(accessInvitations),
  defineApiProcedure({
    name: 'invitations.pending',
    summary:
      'List unexpired, unactivated invitations — the dashboard pending list. ' +
      'Never returns tokens (only the hash is stored); regenerate for a link.',
    action: 'staff.read',
    input: z.object({}).strict(),
    handler: ({ actor }) => accessInvitations.listPendingInvitations({ actor }),
  }),
  defineApiProcedure({
    name: 'invitations.regenerate',
    summary:
      'Rotate a pending invitation’s one-time link (new token + expiry); ' +
      'returns the fresh token once, like creation.',
    action: 'members.invite',
    input: z.object({ invitationId: z.string().min(1) }).strict(),
    handler: ({ actor, input }) =>
      accessInvitations.regenerateInvitationLink({
        actor,
        invitationId: input.invitationId,
      }),
  }),
  ...membershipProcedures(accessMembers),
];
