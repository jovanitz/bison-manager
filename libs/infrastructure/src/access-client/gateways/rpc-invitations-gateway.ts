import { type Result, err, ok } from '@acme/shared';
import { accessDenied, accessGatewayError } from '@acme/application';
import type {
  ApiClient,
  DirectoryGatewayError,
  InvitationsGateway,
} from '@acme/application';

/**
 * Authenticated client adapter for issuing invitations: calls the API's
 * `members.invite` procedure (bearer token attached by the `ApiClient`). The
 * procedure returns the one-time activation token, from which the UI builds the
 * link to hand to the invitee.
 */
export const createRpcInvitationsGateway = (deps: {
  readonly api: ApiClient;
}): InvitationsGateway => ({
  invite: async (input) => {
    const response = await deps.api.request<{
      readonly data: { readonly invitationId: string; readonly token: string };
    }>({
      operation: 'members.invite',
      method: 'POST',
      path: 'rpc/members.invite',
      body: input,
    });
    if (!response.ok) {
      const error: DirectoryGatewayError =
        response.error.status === 401 || response.error.status === 403
          ? accessDenied('Not authorized to invite.')
          : accessGatewayError(response.error.message);
      return err(error) as Result<
        { readonly invitationId: string; readonly token: string },
        DirectoryGatewayError
      >;
    }
    return ok(response.value.data);
  },
});
