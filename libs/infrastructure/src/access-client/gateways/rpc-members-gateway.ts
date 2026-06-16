import { type Result, err, ok } from '@acme/shared';
import { accessDenied, accessGatewayError } from '@acme/application';
import type {
  ApiClient,
  DirectoryGatewayError,
  ManagePermissionsError,
  MemberSummaryDto,
  MembersGateway,
} from '@acme/application';

const isDenied = (status?: number): boolean => status === 401 || status === 403;

/**
 * Authenticated member administration adapter: `members.list` and
 * `permissions.update` through the `ApiClient` (bearer attached). The transport
 * surfaces only status, so errors collapse to denied (401/403) or a gateway
 * error — the super-admin protection itself is enforced server-side, and the
 * editor hides the root, so a generic message here is enough.
 */
export const createRpcMembersGateway = (deps: {
  readonly api: ApiClient;
}): MembersGateway => ({
  listMembers: async (accountId) => {
    const response = await deps.api.request<{
      readonly data: ReadonlyArray<MemberSummaryDto>;
    }>({
      operation: 'members.list',
      method: 'POST',
      path: 'rpc/members.list',
      body: { accountId },
    });
    if (!response.ok) {
      const error: DirectoryGatewayError = isDenied(response.error.status)
        ? accessDenied('Not authorized to list members.')
        : accessGatewayError(response.error.message);
      return err(error) as Result<
        ReadonlyArray<MemberSummaryDto>,
        DirectoryGatewayError
      >;
    }
    return ok(response.value.data);
  },

  updatePermissions: async (input) => {
    const response = await deps.api.request<{ readonly data: unknown }>({
      operation: 'permissions.update',
      method: 'POST',
      path: 'rpc/permissions.update',
      body: input,
    });
    if (!response.ok) {
      const error: ManagePermissionsError = isDenied(response.error.status)
        ? accessDenied('Not authorized to change permissions.')
        : accessGatewayError(response.error.message);
      return err(error) as Result<void, ManagePermissionsError>;
    }
    return ok(undefined);
  },

  removeMember: async (input) => {
    const response = await deps.api.request<{ readonly data: unknown }>({
      operation: 'members.remove',
      method: 'POST',
      path: 'rpc/members.remove',
      body: input,
    });
    if (!response.ok) {
      const error: ManagePermissionsError = isDenied(response.error.status)
        ? accessDenied('Not authorized to remove this member.')
        : accessGatewayError(response.error.message);
      return err(error) as Result<void, ManagePermissionsError>;
    }
    return ok(undefined);
  },

  setMemberBlocked: async (input) => {
    const name = input.blocked ? 'members.block' : 'members.unblock';
    const response = await deps.api.request<{ readonly data: unknown }>({
      operation: name,
      method: 'POST',
      path: `rpc/${name}`,
      body: { membershipId: input.membershipId },
    });
    if (!response.ok) {
      const error: ManagePermissionsError = isDenied(response.error.status)
        ? accessDenied('Not authorized to block this member.')
        : accessGatewayError(response.error.message);
      return err(error) as Result<void, ManagePermissionsError>;
    }
    return ok(undefined);
  },
});
