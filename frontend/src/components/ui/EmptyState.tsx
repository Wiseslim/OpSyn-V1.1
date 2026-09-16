// ============================================================
// OPSYN UI — EmptyState  (Stage 3 rebuild)
// Design tokens: --color-text-primary, --color-text-muted, --font-display, --font-body
// ============================================================

import React from 'react';
import { Button, ButtonVariant } from './Button';

export interface EmptyStateAction {
  label:    string;
  onClick:  () => void;
  variant?: ButtonVariant;
}

export interface EmptyStateProps {
  icon?:     React.ReactNode;
  title:     string;
  message?:  string;
  action?:   EmptyStateAction;
  size?:     'sm' | 'md' | 'lg';
  style?:    React.CSSProperties;
}

const ICON_SIZE:  Record<string, number> = { sm: 28, md: 36, lg: 48 };
const TITLE_SIZE: Record<string, number> = { sm: 13, md: 14, lg: 16 };
const MSG_SIZE:   Record<string, number> = { sm: 12, md: 12, lg: 13 };
const PAD:        Record<string, string> = { sm: '24px 16px', md: '40px 24px', lg: '56px 32px' };

const DefaultIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

// ══ EMPTY STATE ═══════════════════════════════════════════════
export function EmptyState({
  icon,
  title,
  message,
  action,
  size  = 'md',
  style,
}: EmptyStateProps) {
  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      textAlign:      'center',
      padding:        PAD[size],
      color:          'var(--color-text-muted)',
      ...style,
    }}>
      <div style={{
        fontSize:     ICON_SIZE[size],
        marginBottom: 14,
        opacity:      0.35,
        lineHeight:   1,
        color:        'var(--color-text-muted)',
      }}>
        {icon ?? <DefaultIcon size={ICON_SIZE[size]} />}
      </div>

      <div style={{
        fontFamily:   'var(--font-display)',
        fontSize:     TITLE_SIZE[size],
        fontWeight:   700,
        color:        'var(--color-text-primary)',
        marginBottom: message ? 6 : action ? 16 : 0,
      }}>
        {title}
      </div>

      {message && (
        <div style={{
          fontFamily:   'var(--font-body)',
          fontSize:     MSG_SIZE[size],
          color:        'var(--color-text-muted)',
          maxWidth:     340,
          lineHeight:   1.6,
          marginBottom: action ? 18 : 0,
        }}>
          {message}
        </div>
      )}

      {action && (
        <Button
          variant={action.variant ?? 'secondary'}
          size="sm"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
