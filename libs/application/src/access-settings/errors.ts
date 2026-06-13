import { defineError, type TaggedError } from '@acme/shared';
import type { AccessUseCaseError } from '../access/errors';

/** Optimistic-locking conflict: someone saved the settings first. */
export const settingsConflict = defineError('app/settings-conflict');

export type AccessSettingsUseCaseError =
  | AccessUseCaseError
  | TaggedError<'app/settings-conflict'>;
