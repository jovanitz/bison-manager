import { z } from 'zod';
import type { AccessSettingsUseCases } from '@acme/application';
import { defineApiProcedure } from '../rpc/procedure';
import type { ApiProcedure } from '../rpc/procedure';

const sessionPolicySchema = z
  .object({
    idleTtlMs: z.number().int().positive(),
    maxLifetimeMs: z.number().int().positive(),
  })
  .strict();

export const createSettingsProcedures = (
  accessSettings: AccessSettingsUseCases,
): ReadonlyArray<ApiProcedure> => [
  defineApiProcedure({
    name: 'settings.update',
    summary:
      'Reconfigure the session lifetime policy (per account kind, within ' +
      'hard bounds). Tightening shrinks every live session immediately.',
    action: 'settings.update',
    input: z
      .object({
        policies: z
          .object({
            customer: sessionPolicySchema,
            staff: sessionPolicySchema,
          })
          .strict(),
      })
      .strict(),
    handler: ({ actor, input }) =>
      accessSettings.updateSessionPolicy({ actor, policies: input.policies }),
  }),
];
