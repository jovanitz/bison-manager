import { err, ok } from '@acme/shared';
import { accessDenied, accessGatewayError } from '@acme/application';
import type {
  ApiClient,
  DirectoryGatewayError,
  SessionPoliciesDto,
  SettingsGateway,
} from '@acme/application';

const toError = (
  name: string,
  status: number | undefined,
  message: string,
): DirectoryGatewayError =>
  status === 401 || status === 403
    ? accessDenied(`Not authorized for ${name}.`)
    : accessGatewayError(message);

/** Authenticated session-policy admin over the `settings.*` procedures. */
export const createRpcSettingsGateway = (deps: {
  readonly api: ApiClient;
}): SettingsGateway => ({
  read: async () => {
    const response = await deps.api.request<{
      readonly data: {
        readonly policies: SessionPoliciesDto;
        readonly version: number;
      };
    }>({
      operation: 'settings.read',
      method: 'POST',
      path: 'rpc/settings.read',
      body: {},
    });
    return response.ok
      ? ok(response.value.data)
      : err(
          toError(
            'settings.read',
            response.error.status,
            response.error.message,
          ),
        );
  },
  update: async (policies) => {
    const response = await deps.api.request<{ readonly data: unknown }>({
      operation: 'settings.update',
      method: 'POST',
      path: 'rpc/settings.update',
      body: { policies },
    });
    return response.ok
      ? ok(undefined)
      : err(
          toError(
            'settings.update',
            response.error.status,
            response.error.message,
          ),
        );
  },
});
