/**
 * Medicine Manager · Dashboard · Invite Staff — re-skin of the implemented
 * invite-member-form (email → one-time activation link).
 *
 * @screen Medicine Manager / Dashboard / Invite Staff
 * @phase draft
 */
import { useState, type FormEvent } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '../../../design-system/button/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../design-system/card/card';
import { Input } from '../../../design-system/input/input';
import { Label } from '../../../design-system/label/label';
import { Alert, AlertDescription } from '../../../design-system/alert/alert';

export type InviteVM = {
  readonly busy: boolean;
  readonly error?: string;
  /** Shown once after a successful invite. */
  readonly activationLink?: string;
};
export type InviteActions = { readonly onInvite: (email: string) => void };

const ActivationLink = ({ link }: { readonly link: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="grid gap-1.5">
      <Label>Activation link (share once)</Label>
      <div className="flex gap-2">
        <Input readOnly value={link} className="font-mono text-xs" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Copy link"
          onClick={copy}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  );
};

export const InviteView = ({
  vm,
  onInvite,
}: { readonly vm: InviteVM } & InviteActions) => {
  const [email, setEmail] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onInvite(email);
    setEmail('');
  };
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Invite staff</CardTitle>
        <CardDescription>
          Staff join by invitation. Send a one-time activation link.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {vm.error ? (
          <Alert variant="destructive">
            <AlertDescription>{vm.error}</AlertDescription>
          </Alert>
        ) : null}
        <form onSubmit={submit} className="flex items-end gap-2">
          <div className="grid flex-1 gap-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="name@org.com"
            />
          </div>
          <Button type="submit" disabled={vm.busy}>
            Send invitation
          </Button>
        </form>
        {vm.activationLink ? <ActivationLink link={vm.activationLink} /> : null}
      </CardContent>
    </Card>
  );
};
