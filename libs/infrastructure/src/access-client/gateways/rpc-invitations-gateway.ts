import { type Result, err, ok } from '@acme/shared';
import { accessDenied, accessGatewayError } from '@acme/application';
import type {
  ApiClient,
  DirectoryGatewayError,
  InvitationsGateway,
  PendingInvitationSummary,
} from '@acme/application';

/**
 * Authenticated client adapter for the dashboard's invitation flows: issue a
 * link (`members.invite`), list the pending ones (`invitations.pending`), and
 * rotate a link (`invitations.regenerate`). The bearer token is attached by the
 * `ApiClient`; 401/403 collapse to access-denied, every other failure to a
 * gateway error — the same translation the other rpc gateways use.
 */
const callProcedure = async <T>(
  api: ApiClient,
  name: string,
  body: unknown,
): Promise<Result<T, DirectoryGatewayError>> => {
  const response = await api.request<{ readonly data: T }>({
    operation: name,
    method: 'POST',
    path: `rpc/${name}`,
    body,
  });
  if (!response.ok) {
    return err(
      response.error.status === 401 || response.error.status === 403
        ? accessDenied(`Not authorized for ${name}.`)
        : accessGatewayError(response.error.message),
    );
  }
  return ok(response.value.data);
};

export const createRpcInvitationsGateway = (deps: {
  readonly api: ApiClient;
}): InvitationsGateway => ({
  invite: (input) =>
    callProcedure<{ readonly invitationId: string; readonly token: string }>(
      deps.api,
      'members.invite',
      input,
    ),
  listPending: () =>
    callProcedure<ReadonlyArray<PendingInvitationSummary>>(
      deps.api,
      'invitations.pending',
      {},
    ),
  regenerate: (invitationId) =>
    callProcedure<{ readonly token: string }>(
      deps.api,
      'invitations.regenerate',
      { invitationId },
    ),
});
