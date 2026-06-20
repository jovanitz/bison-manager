import type { Result } from '@acme/shared';
import type { PendingInvitationSummary } from '../../access-invitations/ports';
import type {
  ActivationGateway,
  ActivationGatewayError,
  DirectoryGatewayError,
  InvitationsGateway,
  InviteInput,
} from '../ports';

/**
 * The invitation flows a staff dashboard consumes: an authenticated `invite`
 * (issues a one-time activation link) and a public `activate` (the invitee sets
 * their password from the link). Thin forwarders — the server decides
 * everything; the client only carries the inputs.
 */
export type InvitationsUseCases = {
  readonly invite: (
    input: InviteInput,
  ) => Promise<
    Result<
      { readonly invitationId: string; readonly token: string },
      DirectoryGatewayError
    >
  >;
  readonly activate: (input: {
    readonly token: string;
    readonly password: string;
  }) => Promise<Result<{ readonly email: string }, ActivationGatewayError>>;
  readonly listPending: () => Promise<
    Result<ReadonlyArray<PendingInvitationSummary>, DirectoryGatewayError>
  >;
  readonly regenerate: (
    invitationId: string,
  ) => Promise<Result<{ readonly token: string }, DirectoryGatewayError>>;
};

export const makeInvitationsUseCases = (deps: {
  readonly invitations: InvitationsGateway;
  readonly activation: ActivationGateway;
}): InvitationsUseCases => ({
  invite: (input) => deps.invitations.invite(input),
  activate: (input) => deps.activation.activate(input),
  listPending: () => deps.invitations.listPending(),
  regenerate: (invitationId) => deps.invitations.regenerate(invitationId),
});
