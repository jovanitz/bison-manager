import { Badge } from '../../../../design-system/badge/badge';
import type { Permission } from '../roles.types';

/** Read-only permission chips (mono outline badges), "action:scope" — the table
 *  display shared by Roles + Templates. The editable form uses PermissionEditor. */
export const PermissionList = ({
  permissions,
}: {
  readonly permissions: readonly Permission[];
}) => (
  <div className="flex flex-wrap gap-1">
    {permissions.length
      ? permissions.map((p) => (
          <Badge
            key={`${p.action}:${p.scope}`}
            variant="outline"
            className="font-mono"
          >
            {p.action}:{p.scope}
          </Badge>
        ))
      : '—'}
  </div>
);
