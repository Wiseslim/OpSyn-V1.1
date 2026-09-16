// ============================================================
// OPSYN UI — Badge  (Stage 3 rebuild)
// Design tokens only. Auto-color severity map:
//   critical → red  |  high → amber  |  warning → indigo
//   resolved → green |  draft → slate
// Legacy variants preserved for backward compat.
// DM Sans 11px bold, --radius-badge (4px)
// ============================================================

import React from 'react';

export type BadgeVariant =
  // Severity (new)
  | 'critical' | 'high' | 'warning' | 'resolved' | 'draft'
  // Semantic (design-token mapped)
  | 'primary' | 'danger' | 'success' | 'info'
  // Legacy (preserved for backward compat)
  | 'default' | 'brand' | 'green' | 'cyan' | 'blue'
  | 'rose' | 'amber' | 'violet' | 'coral' | 'teal' | 'ghost' | 'indigo';

export type BadgeSize = 'xs' | 'sm' | 'md';

export interface BadgeProps {
  variant?:  BadgeVariant;
  size?:     BadgeSize;
  dot?:      boolean;
  children:  React.ReactNode;
  style?:    React.CSSProperties;
}

interface BadgeStyle { color: string; bg: string; border: string }

const STYLES: Record<BadgeVariant, BadgeStyle> = {
  // ── Severity ────────────────────────────────────────────────
  critical: { color: 'var(--color-red)',    bg: 'rgba(220,38,38,0.10)',  border: '1px solid rgba(220,38,38,0.25)'  },
  high:     { color: 'var(--color-amber)',  bg: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)' },
  warning:  { color: 'var(--color-indigo)', bg: 'rgba(79,70,229,0.10)',  border: '1px solid rgba(79,70,229,0.25)'  },
  resolved: { color: 'var(--color-green)',  bg: 'rgba(22,163,74,0.10)',  border: '1px solid rgba(22,163,74,0.25)'  },
  draft:    { color: 'var(--color-text-muted)', bg: 'var(--color-surface-2)', border: '1px solid var(--color-border)' },
  // ── Semantic ─────────────────────────────────────────────────
  primary:  { color: 'var(--color-navy)',   bg: 'var(--color-teal)',     border: 'none'                            },
  danger:   { color: 'var(--color-red)',    bg: 'rgba(220,38,38,0.10)',  border: '1px solid rgba(220,38,38,0.25)'  },
  success:  { color: 'var(--color-green)',  bg: 'rgba(22,163,74,0.10)',  border: '1px solid rgba(22,163,74,0.25)'  },
  info:     { color: 'var(--color-indigo)', bg: 'rgba(79,70,229,0.10)',  border: '1px solid rgba(79,70,229,0.25)'  },
  // ── Legacy ───────────────────────────────────────────────────
  default:  { color: 'var(--color-text-primary)', bg: 'var(--color-surface-2)', border: '1px solid var(--color-border)' },
  ghost:    { color: 'var(--color-text-muted)',   bg: 'transparent',            border: '1px solid var(--color-border)' },
  brand:    { color: 'var(--color-navy)',   bg: 'var(--color-teal)',     border: 'none'                            },
  green:    { color: 'var(--color-green)',  bg: 'rgba(22,163,74,0.10)',  border: '1px solid rgba(22,163,74,0.20)'  },
  cyan:     { color: 'var(--color-teal)',   bg: 'rgba(0,194,168,0.10)',  border: '1px solid rgba(0,194,168,0.20)'  },
  teal:     { color: 'var(--color-teal)',   bg: 'rgba(0,194,168,0.10)',  border: '1px solid rgba(0,194,168,0.20)'  },
  blue:     { color: 'var(--color-indigo)', bg: 'rgba(79,70,229,0.10)',  border: '1px solid rgba(79,70,229,0.20)'  },
  indigo:   { color: 'var(--color-indigo)', bg: 'rgba(79,70,229,0.10)',  border: '1px solid rgba(79,70,229,0.20)'  },
  rose:     { color: 'var(--color-red)',    bg: 'rgba(220,38,38,0.10)',  border: '1px solid rgba(220,38,38,0.20)'  },
  amber:    { color: 'var(--color-amber)',  bg: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.20)' },
  violet:   { color: '#7C3AED',            bg: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.20)' },
  coral:    { color: '#EA580C',            bg: 'rgba(234,88,12,0.10)',  border: '1px solid rgba(234,88,12,0.20)'  },
};

const PAD:  Record<BadgeSize, string>  = { xs: '1px 5px', sm: '2px 7px', md: '3px 10px' };
const FONT: Record<BadgeSize, number>  = { xs: 9, sm: 11, md: 12 };

// ══ BADGE ═════════════════════════════════════════════════════
export function Badge({
  variant = 'default',
  size    = 'sm',
  dot     = false,
  children,
  style,
}: BadgeProps) {
  const s = STYLES[variant] ?? STYLES.default;

  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      gap:           dot ? 4 : 0,
      padding:       PAD[size],
      borderRadius:  'var(--radius-badge)',
      fontSize:      FONT[size],
      fontWeight:    700,
      fontFamily:    'var(--font-display)',
      letterSpacing: '0.03em',
      color:         s.color,
      background:    s.bg,
      border:        s.border,
      flexShrink:    0,
      lineHeight:    1.4,
      whiteSpace:    'nowrap',
      ...style,
    }}>
      {dot && (
        <span style={{
          width:        5,
          height:       5,
          borderRadius: '50%',
          background:   s.color,
          flexShrink:   0,
        }} />
      )}
      {children}
    </span>
  );
}
