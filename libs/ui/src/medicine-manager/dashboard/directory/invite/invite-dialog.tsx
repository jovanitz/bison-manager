/**
 * Directory-level CTA — invite a new person by email. A header button opens a
 * small dialog; submitting fires onInvite. Presentational (dialog + form state
 * are local UI).
 */
import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../../../design-system/button/button';
import { Input } from '../../../../design-system/input/input';
import { Label } from '../../../../design-system/label/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../../design-system/dialog/dialog';

export const InviteDialog = ({
  onInvite,
}: {
  readonly onInvite: (email: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onInvite(email);
    setEmail('');
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite someone</DialogTitle>
          <DialogDescription>
            Send a one-time activation link to their email.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!email}>
              Send invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
