import { useEffect, useState, type FormEvent } from 'react';
import type { AccessClientUseCases } from '@acme/application';
import { useUseCases } from '../di/use-cases-context';
import { Button } from '../design-system/button/button';
import { Card, CardBody } from '../design-system/card/card';
import { Input } from '../design-system/input/input';

/**
 * First-run check (pre-auth): true only while the instance has no root admin —
 * the one moment the dashboard offers an owner sign-up. Self-correcting if the
 * component unmounts mid-flight.
 */
const useNeedsBootstrap = (
  access: AccessClientUseCases | undefined,
): boolean => {
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  useEffect(() => {
    if (!access) return;
    let active = true;
    void access.needsBootstrap().then((result) => {
      if (active && result.ok) setNeedsBootstrap(result.value);
    });
    return () => {
      active = false;
    };
  }, [access]);
  return needsBootstrap;
};

type LoginFormProps = {
  readonly notice?: string | undefined;
  readonly needsBootstrap: boolean;
  readonly email: string;
  readonly password: string;
  readonly busy: boolean;
  readonly error?: string | undefined;
  readonly onEmail: (value: string) => void;
  readonly onPassword: (value: string) => void;
  readonly onSignIn: (event: FormEvent) => void;
  readonly onSignUp: (event: FormEvent) => void;
};

/** Presentation only — the screen below owns state and the auth calls. */
const LoginForm = (props: LoginFormProps) => (
  <form
    aria-label="login"
    onSubmit={props.onSignIn}
    className="flex flex-col gap-4"
  >
    <h1 className="text-lg font-medium text-card-foreground">Staff sign in</h1>
    {props.notice ? (
      <p
        role="status"
        className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
      >
        {props.notice}
      </p>
    ) : null}
    {props.needsBootstrap ? (
      <p
        role="status"
        className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground"
      >
        No owner exists yet — create the first one to claim this instance.
      </p>
    ) : null}
    <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
      Email
      <Input
        type="email"
        autoComplete="username"
        value={props.email}
        onChange={(e) => props.onEmail(e.target.value)}
        required
      />
    </label>
    <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
      Password
      <Input
        type="password"
        autoComplete={
          props.needsBootstrap ? 'new-password' : 'current-password'
        }
        value={props.password}
        onChange={(e) => props.onPassword(e.target.value)}
        required
      />
    </label>
    <Button type="submit" disabled={props.busy}>
      Sign in
    </Button>
    {props.needsBootstrap ? (
      <Button
        type="button"
        variant="secondary"
        disabled={props.busy}
        onClick={props.onSignUp}
      >
        Create the first owner
      </Button>
    ) : null}
    {props.error ? (
      <p role="alert" className="text-sm text-destructive">
        {props.error}
      </p>
    ) : null}
  </form>
);

/**
 * Dashboard sign-in. Normally login-only — staff accounts are created by
 * invitation, never self-service. The ONE exception is first-run: while no root
 * admin exists, the screen also offers a one-time owner sign-up (the server's
 * `rootAdminExists` guard is the real gate; this only shows the button on a
 * fresh instance). On success the auth provider fires its change event and
 * `RequireAdmin` re-resolves into the dashboard.
 */
export const DashboardLoginScreen = ({
  notice,
}: {
  /** Shown above the form, e.g. when a signed-in user lacks admin access. */
  readonly notice?: string;
}) => {
  const { access } = useUseCases();
  const needsBootstrap = useNeedsBootstrap(access);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  if (!access) {
    return <p>Access use cases are not wired in this app yet.</p>;
  }

  const submit = async (event: FormEvent, flow: 'signIn' | 'signUp') => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    const result =
      flow === 'signUp'
        ? await access.signUp({ email, password })
        : await access.signIn({ email, password });
    setBusy(false);
    if (!result.ok) setError(result.error.message);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardBody>
          <LoginForm
            notice={notice}
            needsBootstrap={needsBootstrap}
            email={email}
            password={password}
            busy={busy}
            error={error}
            onEmail={setEmail}
            onPassword={setPassword}
            onSignIn={(e) => void submit(e, 'signIn')}
            onSignUp={(e) => void submit(e, 'signUp')}
          />
        </CardBody>
      </Card>
    </div>
  );
};
