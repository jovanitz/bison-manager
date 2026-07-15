import { ok, err } from '@acme/shared';
import {
  notificationFailed,
  type EmailMessage,
  type NotificationSender,
} from '@acme/application';

/**
 * Captures messages instead of sending them — the test double, and the shape a
 * real provider adapter (SMTP / Resend / SES) has to satisfy.
 */
export type InMemoryNotificationSender = NotificationSender & {
  readonly sent: ReadonlyArray<EmailMessage>;
};

export const createInMemoryNotificationSender = (
  behaviour: { readonly failWith?: string } = {},
): InMemoryNotificationSender => {
  const sent: EmailMessage[] = [];
  return {
    sent,
    send: async (message) => {
      if (behaviour.failWith)
        return err(notificationFailed(behaviour.failWith));
      sent.push(message);
      return ok(undefined);
    },
  };
};

/**
 * LOCAL DEV ONLY: prints the message (link included) to the server log, so the
 * invitation arc is exercisable without a mail provider. Never in production —
 * it would report success while nothing is delivered.
 */
export const createConsoleNotificationSender = (): NotificationSender => ({
  send: async (message) => {
    console.info(
      `[email:dev] to=${message.to} subject=${message.subject}\n${message.body}`,
    );
    return ok(undefined);
  },
});

/**
 * The fail-closed default when no provider is configured. It refuses loudly
 * instead of pretending: a "Resend email" button that silently delivers nothing
 * is worse than one that says the mailer is not set up. Swap this for a real
 * provider adapter in the composition root — nothing else moves.
 */
export const createUnconfiguredNotificationSender = (): NotificationSender => ({
  send: async () =>
    err(
      notificationFailed(
        'No email provider is configured, so the message was not sent.',
      ),
    ),
});
