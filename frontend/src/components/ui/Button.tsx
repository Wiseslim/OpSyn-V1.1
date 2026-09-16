// ============================================================
// OPSYN UI — Button  (Stage 3 rebuild)
// Design tokens: --color-teal, --color-red, --color-navy, etc.
// Variants: primary, secondary, danger, ghost
//   + legacy aliases: brand→primary, rose→danger, outline→secondary,
//                     jade→jade, amber→amber, cyan→primary
// Sizes: xs(28px), sm(32px), md(40px), lg(48px)
// ============================================================

import React from 'react';

export type ButtonVariant =
  | 'primary' | 'secondary' | 'danger' | 'ghost'
  | 'brand' | 'rose' | 'jade' | 'amber' | 'outline' | 'cyan';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:   ButtonVariant;
  size?:      ButtonSize;
  loading?:   boolean;
  fullWidth?: boolean;
  leftIcon?:  React.ReactNode;
  rightIcon?: React.ReactNode;
}

// ── Normalise legacy variant names → canonical set ─────────────
type Canonical = 'primary' | 'secondary' | 'danger' | 'ghost' | 'amber' | 'jade';

function canon(v: ButtonVariant): Canonical {
  if (v === 'brand' || v === 'cyan') return 'primary';
  if (v === 'outline')               return 'secondary';
  if (v === 'rose')                  return 'danger';
  return v as Canonical;
}

const BG: Record<Canonical, string> = {
  primary:   'var(--color-teal)',
  secondary: 'transparent',
  danger:    'rgba(220,38,38,0.10)',
  ghost:     'rgba(0,0,0,0.04)',
  amber:     'rgba(245,158,11,0.10)',
  jade:      'rgba(22,163,74,0.10)',
};

const COLOR: Record<Canonical, string> = {
  primary:   'var(--color-navy)',
  secondary: 'var(--color-text-primary)',
  danger:    'var(--color-red)',
  ghost:     'var(--color-text-primary)',
  amber:     'var(--color-amber)',
  jade:      'var(--color-green)',
};

const BORDER: Record<Canonical, string> = {
  primary:   'none',
  secondary: '1px solid var(--color-border)',
  danger:    '1px solid rgba(220,38,38,0.25)',
  ghost:     '1px solid var(--color-border)',
  amber:     '1px solid rgba(245,158,11,0.20)',
  jade:      '1px solid rgba(22,163,74,0.20)',
};

const BG_HOVER: Record<Canonical, string> = {
  primary:   'var(--color-teal-dim)',
  secondary: 'var(--color-surface-2)',
  danger:    'rgba(220,38,38,0.16)',
  ghost:     'var(--color-surface-2)',
  amber:     'rgba(245,158,11,0.18)',
  jade:      'rgba(22,163,74,0.18)',
};

// Heights match spec: xs=28, sm=32, md=40, lg=48
const HEIGHT: Record<ButtonSize, number> = { xs: 28, sm: 32, md: 40, lg: 48 };
const PAD:    Record<ButtonSize, string>  = { xs: '0 8px', sm: '0 12px', md: '0 16px', lg: '0 22px' };
const FONT:   Record<ButtonSize, number>  = { xs: 10, sm: 12, md: 13, lg: 14 };

// ══ BUTTON ════════════════════════════════════════════════════
export function Button({
  variant   = 'ghost',
  size      = 'md',
  loading   = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  disabled,
  children,
  style,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const c = canon(variant);

  const handleEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isDisabled) (e.currentTarget as HTMLElement).style.background = BG_HOVER[c];
    onMouseEnter?.(e);
  };
  const handleLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isDisabled) (e.currentTarget as HTMLElement).style.background = BG[c];
    onMouseLeave?.(e);
  };

  return (
    <button
      disabled={isDisabled}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            6,
        height:         HEIGHT[size],
        padding:        PAD[size],
        borderRadius:   8,
        fontSize:       FONT[size],
        fontWeight:     600,
        fontFamily:     'var(--font-display)',
        whiteSpace:     'nowrap',
        cursor:         isDisabled ? 'not-allowed' : 'pointer',
        opacity:        isDisabled ? 0.5 : 1,
        transition:     'background 150ms, opacity 150ms',
        background:     BG[c],
        color:          COLOR[c],
        border:         BORDER[c],
        width:          fullWidth ? '100%' : undefined,
        ...style,
      }}
      {...rest}
    >
      {loading ? <BtnSpinner /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}

function BtnSpinner() {
  return (
    <span style={{
      display:        'inline-block',
      width:          14,
      height:         14,
      borderRadius:   '50%',
      border:         '2px solid currentColor',
      borderTopColor: 'transparent',
      animation:      'spin .6s linear infinite',
      flexShrink:     0,
    }} />
  );
}
