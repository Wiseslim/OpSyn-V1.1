// ============================================================
// OPSYN UI — Card  (Stage 3 rebuild)
// Design tokens: --color-surface, --color-border, --radius-card, --shadow-panel
// Variants: default, elevated, inset, ghost
// Optional: header/body/footer slot props, skeleton pulse, clickable hover lift
// ============================================================

import React from 'react';

export type CardVariant = 'default' | 'elevated' | 'inset' | 'ghost';

export interface CardProps {
  variant?:    CardVariant;
  accent?:     boolean;
  accentColor?: string;
  padding?:    number | string;
  header?:     React.ReactNode;
  footer?:     React.ReactNode;
  children:    React.ReactNode;
  skeleton?:   boolean;
  style?:      React.CSSProperties;
  onClick?:    () => void;
}

const BG: Record<CardVariant, string> = {
  default:  'white',
  elevated: 'white',
  inset:    'var(--color-surface-2)',
  ghost:    'transparent',
};

const BORDER: Record<CardVariant, string> = {
  default:  '1px solid var(--color-border)',
  elevated: '1px solid var(--color-border)',
  inset:    '1px solid var(--color-border)',
  ghost:    'none',
};

const SHADOW: Record<CardVariant, string> = {
  default:  'none',
  elevated: 'var(--shadow-panel)',
  inset:    'none',
  ghost:    'none',
};

// ══ CARD ══════════════════════════════════════════════════════
export function Card({
  variant      = 'default',
  accent       = false,
  accentColor  = 'var(--color-teal)',
  padding      = 16,
  header,
  footer,
  children,
  skeleton     = false,
  style,
  onClick,
}: CardProps) {
  const isClickable = Boolean(onClick);

  if (skeleton) {
    return (
      <div style={{
        background:   BG[variant],
        border:       BORDER[variant],
        borderRadius: 'var(--radius-card)',
        padding,
        boxShadow:    SHADOW[variant],
        ...style,
      }}>
        <SkeletonBlock height={16} width="60%" style={{ marginBottom: 12 }} />
        <SkeletonBlock height={12} width="100%" style={{ marginBottom: 8 }} />
        <SkeletonBlock height={12} width="80%" />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      style={{
        position:     'relative',
        overflow:     'hidden',
        background:   BG[variant],
        border:       BORDER[variant],
        borderRadius: 'var(--radius-card)',
        boxShadow:    SHADOW[variant],
        cursor:       isClickable ? 'pointer' : undefined,
        transition:   isClickable ? 'transform 150ms, box-shadow 150ms' : undefined,
        ...style,
      }}
      onMouseEnter={isClickable ? e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-panel)';
      } : undefined}
      onMouseLeave={isClickable ? e => {
        (e.currentTarget as HTMLElement).style.transform = '';
        (e.currentTarget as HTMLElement).style.boxShadow = SHADOW[variant];
      } : undefined}
    >
      {/* Teal top accent line */}
      {accent && (
        <div style={{
          position:   'absolute',
          top:        0,
          left:       0,
          right:      0,
          height:     2,
          background: accentColor,
        }} />
      )}

      {/* Header slot */}
      {header && (
        <div style={{
          padding:      `${typeof padding === 'number' ? padding : 16}px`,
          paddingBottom: 0,
        }}>
          {header}
        </div>
      )}

      {/* Body */}
      <div style={{ padding }}>
        {children}
      </div>

      {/* Footer slot */}
      {footer && (
        <div style={{
          padding:     `${typeof padding === 'number' ? Math.round(Number(padding) * 0.75) : 12}px ${typeof padding === 'number' ? padding : 16}px`,
          borderTop:   '1px solid var(--color-border)',
          background:  'var(--color-surface-2)',
        }}>
          {footer}
        </div>
      )}
    </div>
  );
}

// ── Internal skeleton block ─────────────────────────────────────
function SkeletonBlock({ height, width, style }: { height: number; width?: string; style?: React.CSSProperties }) {
  return (
    <div style={{
      height,
      width:        width ?? '100%',
      borderRadius: 4,
      background:   'linear-gradient(90deg, var(--color-surface-2) 25%, var(--color-border) 50%, var(--color-surface-2) 75%)',
      backgroundSize: '200% 100%',
      animation:    'shimmer 1.5s ease-in-out infinite',
      ...style,
    }} />
  );
}
