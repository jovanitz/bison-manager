import { useEffect } from 'react';
import { useAuditStore, useStore } from '../store/hooks';
import type { AuditStore } from '../store/admin/audit-store';

/** Read-only audit-trail table. Pure presentation over the audit store. */
const AuditView = ({ store }: { readonly store: AuditStore }) => {
  const vm = useStore(store, (s) => s.vm);

  useEffect(() => {
    void store.getState().load();
  }, [store]);

  if (!vm || vm.hidden) return null;

  return (
    <section aria-label="audit trail section">
      <h2>Audit trail ({vm.entries.length})</h2>
      <p>The append-only record of sensitive security events (most recent).</p>
      <table aria-label="audit trail">
        <thead>
          <tr>
            <th>Event</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {vm.entries.map((entry) => (
            <tr key={entry.id}>
              <td>{entry.event.type}</td>
              <td>{entry.event.occurredAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};

export const AuditSection = () => {
  const store = useAuditStore();
  if (!store) return null;
  return <AuditView store={store} />;
};
