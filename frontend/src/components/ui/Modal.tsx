// ============================================================
// OPSYN UI — Modal  (Stage 3 rebuild)
// Design tokens: --radius-card, --shadow-panel, --color-navy-light, --color-border
// Features: focus trap, Escape close, slide-up animation (translateY 16px → 0)
//           backdrop click to close, header + footer slots
// ============================================================

import React, { useEffect, useRef } from 'react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  open:             boolean;
  onClose:          () => void;
  title?:           React.ReactNode;
  children:         React.ReactNode;
  footer?:          React.ReactNode;
  size?:            ModalSize;
  closeOnBackdrop?: boolean;
  style?:           React.CSSProperties;
}

const MAX_W: Record<ModalSize, number> = {
  sm:  380,
  md:  520,
  lg:  680,
  xl:  860,
};

// Focusable element selector for focus-trap
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

// ══ MODAL ═════════════════════════════════════════════════════
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size            = 'md',
  closeOnBackdrop = true,
  style,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape key close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Focus trap + initial focus
  useEffect(() => {
    if (!open) return;
    const el = panelRef.current;
    if (!el) return;

    const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = items[0];
    const last  = items[items.length - 1];

    // Move focus into modal
    (first ?? el).focus();

    function trap(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      if (items.length === 0) { e.preventDefault(); return; }
      if (e.shiftKey) {
        if (document.activeElement === first || document.activeElement === el) {
          last?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first?.focus();
          e.preventDefault();
        }
      }
    }

    el.addEventListener('keydown', trap);
    return () => el.removeEventListener('keydown', trap);
  }, [open]);

  if (!open) return null;

  return (
    <div
      onClick={closeOnBackdrop
        ? (e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose(); }
        : undefined}
      style={{
        position:       'fixed',
        inset:          0,
        background:     'rgba(13,27,42,0.80)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        zIndex:         300,
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        padding:        16,
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Dialog'}
        style={{
          background:   'white',
          border:       '1px solid var(--color-border)',
          borderRadius: 'var(--radius-card)',
          width:        '100%',
          maxWidth:     MAX_W[size],
          maxHeight:    '90vh',
          overflowY:    'auto',
          boxShadow:    'var(--shadow-panel)',
          scrollbarWidth: 'none',
          animation:    'modalIn 200ms ease both',
          outline:      'none',
          ...style,
        }}
      >
        {/* Header */}
        {title !== undefined && (
          <div style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '18px 22px 0',
            marginBottom:   16,
          }}>
            <span style={{
              fontFamily:    'var(--font-display)',
              fontSize:      16,
              fontWeight:    700,
              color:         'var(--color-text-primary)',
              letterSpacing: '-0.01em',
            }}>
              {title}
            </span>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              style={{
                background:  'none',
                border:      'none',
                cursor:      'pointer',
                color:       'var(--color-text-muted)',
                fontSize:    18,
                lineHeight:  1,
                padding:     4,
                borderRadius: 4,
                transition:  'color 150ms',
                flexShrink:  0,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'; }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Body */}
        <div style={{ padding: title !== undefined ? '0 22px' : 22 }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            display:        'flex',
            justifyContent: 'flex-end',
            gap:            8,
            padding:        '14px 22px 18px',
            borderTop:      '1px solid var(--color-border)',
            marginTop:      16,
          }}>
            {footer}
          </div>
        )}

        {/* Bottom padding when no footer */}
        {!footer && <div style={{ height: 18 }} />}
      </div>
    </div>
  );
}
