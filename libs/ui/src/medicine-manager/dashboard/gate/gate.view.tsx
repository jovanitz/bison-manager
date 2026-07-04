/**
 * Medicine Manager · Dashboard · Gate — the non-login states of the admin gate
 * (`RequireAdmin`/`AdminGate`): `loading` and `blocked`. The `forbidden` and
 * anonymous states render the Login view; `authorized` renders the dashboard.
 *
 * @screen Medicine Manager / Dashboard / Gate
 * @phase draft
 *
 * Presentational: a pure function of (state + onSignOut). No architecture imports.
 */
import type { ReactNode } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '../../../design-system/button/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../design-system/card/card';

export type GateVM = { readonly state: 'loading' | 'blocked' };
export type GateActions = { readonly onSignOut: () => void };

const CenteredPage = ({ children }: { readonly children: ReactNode }) => (
  <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
    {children}
  </div>
);

export const GateView = ({
  vm,
  onSignOut,
}: { readonly vm: GateVM } & GateActions) => {
  if (vm.state === 'loading') {
    return (
      <CenteredPage>
        <div
          role="status"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      </CenteredPage>
    );
  }
  return (
    <CenteredPage>
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center gap-2 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <ShieldAlert className="size-5" />
          </span>
          <CardTitle>Access blocked</CardTitle>
          <CardDescription>
            You can sign in, but operations are unavailable. Please contact the
            platform team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={onSignOut} className="w-full">
            Sign out
          </Button>
        </CardContent>
      </Card>
    </CenteredPage>
  );
};
