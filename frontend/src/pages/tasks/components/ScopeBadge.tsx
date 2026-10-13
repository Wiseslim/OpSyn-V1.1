// ============================================================
// OPSYN TASK SCOPE BADGE — Phase 11
// Visual indicator for task scope (Internal / External)
// Blue for Internal, Green for External
// ============================================================

import { Badge, type BadgeSize } from '../../../components/ui/Badge';

interface Props {
  scope: 'internal' | 'external' | undefined;
  size?: BadgeSize;
}

const SCOPE_CONFIG = {
  internal: {
    label: 'Internal',
    variant: 'info' as const,
  },
  external: {
    label: 'External',
    variant: 'success' as const,
  },
};

export default function ScopeBadge({ scope, size = 'xs' }: Props) {
  if (!scope) return null;

  const config = SCOPE_CONFIG[scope];
  if (!config) return null;

  return (
    <Badge
      variant={config.variant}
      size={size}
      style={{
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {config.label}
    </Badge>
  );
}