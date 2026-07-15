import { defineError, type Result, type TaggedError } from '@acme/shared';

/**
 * Outbound notification port — provider agnostic (SMTP, Resend, SES, …).
 *
 * Deliberately dumb: it takes a fully-rendered message and sends it. Deciding
 * WHAT to say and WHEN belongs to the use cases (invitation resend today;
 * billing dunning next — ADR-0018 Decision 6/7 needs exactly this seam), so a
 * provider swap is a composition-root change and nothing else moves.
 */
export type EmailMessage = {
  readonly to: string;
  readonly subject: string;
  /** Plain text. Rendering HTML is a provider concern, not a domain one. */
  readonly body: string;
};

/**
 * Delivery is NOT guaranteed by a successful return — it means the provider
 * accepted the message. Anything past that (bounces, spam) is out of band.
 * Fails with a `Result`, never a throw: a mail outage must not take down the
 * operation that triggered it unless that operation says so.
 */
export type NotificationError = TaggedError<'app/notification-failed'>;

/** Adapters construct their failure through this, so the tag stays in one place. */
export const notificationFailed = defineError('app/notification-failed');

export type NotificationSender = {
  readonly send: (
    message: EmailMessage,
  ) => Promise<Result<void, NotificationError>>;
};
