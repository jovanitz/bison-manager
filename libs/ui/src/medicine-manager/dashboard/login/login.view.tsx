/**
 * Medicine Manager · Dashboard · Login (staff sign-in).
 *
 * @screen Medicine Manager / Dashboard / Login
 * @phase draft
 *
 * Presentational re-skin of the implemented `dashboard/login-screen` LoginForm —
 * same contract (VM + actions), now on the design system with better UX
 * (branded card, show/hide password, inline alerts, busy state). No architecture
 * imports; the existing DashboardLoginScreen state maps 1:1 when wired.
 */
import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Loader2, Pill } from 'lucide-react';
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
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '../../../design-system/alert/alert';

export type LoginVM = {
  readonly email: string;
  readonly password: string;
  readonly busy: boolean;
  readonly error?: string;
  /** Contextual message above the form (e.g. "signed in but not an admin"). */
  readonly notice?: string;
  /** First-run: no owner exists yet → offer the one-time owner sign-up. */
  readonly needsBootstrap: boolean;
};

export type LoginActions = {
  readonly onEmail: (value: string) => void;
  readonly onPassword: (value: string) => void;
  readonly onSignIn: (event: FormEvent) => void;
  readonly onSignUp: (event: FormEvent) => void;
};

const Notices = ({ vm }: { readonly vm: LoginVM }) => (
  <>
    {vm.notice ? (
      <Alert variant="info">
        <AlertDescription>{vm.notice}</AlertDescription>
      </Alert>
    ) : null}
    {vm.needsBootstrap ? (
      <Alert variant="info">
        <AlertTitle>Claim this instance</AlertTitle>
        <AlertDescription>
          No owner exists yet — create the first one to get started.
        </AlertDescription>
      </Alert>
    ) : null}
    {vm.error ? (
      <Alert variant="destructive">
        <AlertTitle>Couldn&rsquo;t sign in</AlertTitle>
        <AlertDescription>{vm.error}</AlertDescription>
      </Alert>
    ) : null}
  </>
);

const PasswordField = ({
  vm,
  onPassword,
}: {
  readonly vm: LoginVM;
  readonly onPassword: (v: string) => void;
}) => {
  const [show, setShow] = useState(false);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="login-password">Password</Label>
      <div className="relative">
        <Input
          id="login-password"
          type={show ? 'text' : 'password'}
          autoComplete={vm.needsBootstrap ? 'new-password' : 'current-password'}
          value={vm.password}
          onChange={(e) => onPassword(e.target.value)}
          required
          className="pr-9"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
};

export const LoginView = ({
  vm,
  onEmail,
  onPassword,
  onSignIn,
  onSignUp,
}: { readonly vm: LoginVM } & LoginActions) => (
  <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center gap-2 text-center">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Pill className="size-5" />
        </span>
        <CardTitle>Medicine Manager</CardTitle>
        <CardDescription>Sign in to the staff console.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Notices vm={vm} />
        <form
          aria-label="login"
          onSubmit={onSignIn}
          className="flex flex-col gap-4"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="username"
              value={vm.email}
              onChange={(e) => onEmail(e.target.value)}
              required
            />
          </div>
          <PasswordField vm={vm} onPassword={onPassword} />
          <Button type="submit" disabled={vm.busy} className="mt-1">
            {vm.busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {vm.busy ? 'Signing in…' : 'Sign in'}
          </Button>
          {vm.needsBootstrap ? (
            <Button
              type="button"
              variant="secondary"
              disabled={vm.busy}
              onClick={onSignUp}
            >
              Create the first owner
            </Button>
          ) : null}
        </form>
      </CardContent>
    </Card>
  </div>
);
