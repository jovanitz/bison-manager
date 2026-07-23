/**
 * Medicine Manager · Dashboard · Session policy — idle + absolute lifetimes per
 * account kind (ADR-0010). A staff form gated by `settings.update`: read the
 * live policy, edit the four lifetimes, save. Read-only without the capability.
 *
 * @screen Medicine Manager / Dashboard / Settings
 * @phase approved
 *
 * Presentational: a pure function of (ViewModel + actions). `loading`, `error`,
 * `saving`, `notice` and `canManage` are DATA on the VM; only the edited form is
 * view-local (re-seeded whenever the loaded policy changes).
 */
import { useEffect, useState, type FormEvent } from 'react';
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
import { Skeleton } from '../../../design-system/skeleton/skeleton';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '../../../design-system/alert/alert';

export type SessionPolicyForm = {
  readonly customerIdle: number;
  readonly customerMax: number;
  readonly staffIdle: number;
  readonly staffMax: number;
};

export type SettingsVM = {
  readonly policy: SessionPolicyForm;
  readonly canManage: boolean;
  readonly loading: boolean;
  readonly error?: string | undefined;
  readonly saving?: boolean | undefined;
  readonly notice?: string | undefined;
};
export type SettingsActions = {
  readonly onSave: (policy: SessionPolicyForm) => void;
};

const FIELDS: ReadonlyArray<readonly [keyof SessionPolicyForm, string]> = [
  ['customerIdle', 'Customer idle (ms)'],
  ['customerMax', 'Customer max lifetime (ms)'],
  ['staffIdle', 'Staff idle (ms)'],
  ['staffMax', 'Staff max lifetime (ms)'],
];

export const SettingsView = ({
  vm,
  onSave,
}: { readonly vm: SettingsVM } & SettingsActions) => {
  const [form, setForm] = useState<SessionPolicyForm>(vm.policy);
  useEffect(() => setForm(vm.policy), [vm.policy]);
  if (vm.loading) return <Skeleton className="h-72 max-w-lg" />;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave(form);
  };
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Session policy</CardTitle>
        <CardDescription>
          Idle + absolute lifetimes per account kind, in milliseconds.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {vm.error ? (
          <Alert variant="destructive">
            <AlertTitle>Couldn’t save the policy</AlertTitle>
            <AlertDescription>{vm.error}</AlertDescription>
          </Alert>
        ) : null}
        {vm.notice ? (
          <Alert variant="info">
            <AlertDescription>{vm.notice}</AlertDescription>
          </Alert>
        ) : null}
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map(([key, label]) => (
            <div key={key} className="grid gap-1.5">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                type="number"
                value={form[key]}
                disabled={!vm.canManage}
                onChange={(e) =>
                  setForm({ ...form, [key]: Number(e.target.value) })
                }
              />
            </div>
          ))}
          {vm.canManage ? (
            <div className="sm:col-span-2">
              <Button type="submit" loading={vm.saving}>
                Save policy
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              You don’t have permission to change the session policy.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
};
