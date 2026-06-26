import { type FormEvent, useEffect, useState } from 'react';
import type { SessionPoliciesDto } from '@acme/application';
import { useSettingsStore, useStore } from '../store/hooks';
import type { SettingsStore } from '../store/admin/settings-store';

type Form = {
  customerIdle: number;
  customerMax: number;
  staffIdle: number;
  staffMax: number;
};

const toForm = (p: SessionPoliciesDto): Form => ({
  customerIdle: p.customer.idleTtlMs,
  customerMax: p.customer.maxLifetimeMs,
  staffIdle: p.staff.idleTtlMs,
  staffMax: p.staff.maxLifetimeMs,
});

const SettingsView = ({ store }: { readonly store: SettingsStore }) => {
  const vm = useStore(store, (s) => s.vm);
  const notice = useStore(store, (s) => s.notice);
  const [form, setForm] = useState<Form | null>(null);

  useEffect(() => {
    void store.getState().load();
  }, [store]);
  useEffect(() => {
    if (vm && !vm.hidden) setForm(toForm(vm.policies));
  }, [vm]);

  if (!vm || vm.hidden || !form) return null;

  const field = (key: keyof Form) => (event: { target: { value: string } }) =>
    setForm({ ...form, [key]: Number(event.target.value) });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void store.getState().save({
      customer: {
        idleTtlMs: form.customerIdle,
        maxLifetimeMs: form.customerMax,
      },
      staff: { idleTtlMs: form.staffIdle, maxLifetimeMs: form.staffMax },
    });
  };

  return (
    <section aria-label="session policy section">
      <h2>Session policy</h2>
      <p>Idle + absolute lifetimes per account kind, in milliseconds.</p>
      {notice ? <p role="status">{notice}</p> : null}
      <form aria-label="session policy" onSubmit={submit}>
        {(
          [
            ['customer idle', 'customerIdle'],
            ['customer max', 'customerMax'],
            ['staff idle', 'staffIdle'],
            ['staff max', 'staffMax'],
          ] as ReadonlyArray<readonly [string, keyof Form]>
        ).map(([label, key]) => (
          <label key={key}>
            {label}
            <input
              type="number"
              aria-label={label}
              value={form[key]}
              onChange={field(key)}
            />
          </label>
        ))}
        <button type="submit">Save policy</button>
      </form>
    </section>
  );
};

export const SettingsSection = () => {
  const store = useSettingsStore();
  if (!store) return null;
  return <SettingsView store={store} />;
};
