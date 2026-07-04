/**
 * Medicine Manager · Dashboard · Session policy — idle + absolute lifetimes per
 * account kind (re-skin of the implemented settings-section).
 *
 * @screen Medicine Manager / Dashboard / Settings
 * @phase draft
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

export type SessionPolicyForm = {
  readonly customerIdle: number;
  readonly customerMax: number;
  readonly staffIdle: number;
  readonly staffMax: number;
};

export type SettingsVM = {
  readonly policy: SessionPolicyForm;
  readonly notice?: string;
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
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map(([key, label]) => (
            <div key={key} className="grid gap-1.5">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                type="number"
                value={form[key]}
                onChange={(e) =>
                  setForm({ ...form, [key]: Number(e.target.value) })
                }
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <Button type="submit">Save policy</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
