import { toast } from '../../../../design-system/toast/toaster';
import type { TokenResult } from '../../store/directory-store';

/**
 * The link the invitee opens. The token rides in the URL FRAGMENT (`#token=`),
 * which browsers never send to a server — so it stays out of access logs and
 * Referer headers. Mirrors what `ActivateInvitationScreen` reads.
 */
export const activationLink = (token: string): string =>
  `${window.location.origin}/activate#token=${encodeURIComponent(token)}`;

/**
 * An invitation's plaintext token exists for exactly ONE moment: when it is
 * issued. Only its hash is stored, so there is no such thing as "copy the
 * existing link" — copying means MINTING a fresh one, which is why every entry
 * point here goes through an issue/rotate call and says so in its message.
 *
 * If the clipboard is unavailable (denied permission, insecure context) we show
 * the link instead of swallowing it: losing a one-time token silently would
 * force the admin to rotate again.
 */
export const copyFreshLink = async (
  result: TokenResult,
  success: string,
): Promise<void> => {
  if (!result.ok) {
    toast.error(result.message);
    return;
  }
  const link = activationLink(result.token);
  try {
    await navigator.clipboard.writeText(link);
    toast.success(success);
  } catch {
    toast.message('Copy this activation link', { description: link });
  }
};
