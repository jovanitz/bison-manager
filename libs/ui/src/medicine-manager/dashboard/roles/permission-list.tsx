import { Badge } from '../../../design-system/badge/badge';

/** Permission chips (mono outline badges) — shared by Roles + Templates. */
export const PermissionList = ({
  permissions,
}: {
  readonly permissions: readonly string[];
}) => (
  <div className="flex flex-wrap gap-1">
    {permissions.length
      ? permissions.map((p) => (
          <Badge key={p} variant="outline" className="font-mono">
            {p}
          </Badge>
        ))
      : '—'}
  </div>
);
