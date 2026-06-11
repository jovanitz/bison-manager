import { defineError } from '@acme/shared';

/**
 * Errors of the client-side access feature. Transport/HTTP failures collapse
 * into `app/access-gateway-error`; a 401/403 from the API surfaces as the
 * existing `app/access-denied` so the UI treats both lines of defense alike.
 */
export const accessGatewayError = defineError('app/access-gateway-error');
