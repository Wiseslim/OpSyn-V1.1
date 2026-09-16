// ============================================================
// OPSYN — BlockReasonModal
// Explicit block action modal. User must provide a reason
// before the task transitions to Blocked. Blueprint §2.2
// ============================================================

import { useState, useEffect, useRef } from 'react';

export interface BlockReasonModalProps {
  onConfirm:  (reason: string) => void;
  onClose:    () => void;
  isPending:  boolean;
}

export function BlockReasonModal({ onConfirm, onClose, isPending }: BlockReasonModalProps) {
  const [reason, setReason] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const canSubmit = reason.trim().length > 0 && !isPending;

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(2,4,12,.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div style={{
        background:   'var(--bg2)',
        border:       '1px solid rgba(244,63,94,.35)',
        borderRadius: 14,
        padding:      22,
        width:        '100%',
        maxWidth:     420,
        boxShadow:    '0 20px 60px rgba(0,0,0,.65)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 20 }}>🚫</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--rose)', letterSpacing: '-.02em' }}>
              Mark as Blocked
            </div>
            <div style={{ fontSize: 11, color: 'var(--chalk3)', marginTop: 1 }}>
              Provide a reason so the team understands the blocker.
            </div>
          </div>
        </div>

        {/* Reason textarea */}
        <textarea
          ref={textareaRef}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Describe what is blocking this task…"
          rows={4}
          style={{
            width:       '100%',
            background:  'var(--bg3)',
            border:      '1px solid var(--wire2)',
            borderRadius: 8,
            padding:     '9px 11px',
            color:       'var(--chalk)',
            fontFamily:  'var(--font)',
            fontSize:    12,
            lineHeight:  1.55,
            outline:     'none',
            resize:      'none',
            boxSizing:   'border-box',
          }}
        />

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button
            onClick={onClose}
            disabled={isPending}
            style={{
              padding:     '7px 14px',
              borderRadius: 8,
              border:      '1px solid var(--wire2)',
              background:  'rgba(255,255,255,.04)',
              color:       'var(--chalk2)',
              fontSize:    12,
              fontWeight:  600,
              cursor:      isPending ? 'not-allowed' : 'pointer',
              fontFamily:  'var(--font)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => canSubmit && onConfirm(reason.trim())}
            disabled={!canSubmit}
            style={{
              padding:     '7px 16px',
              borderRadius: 8,
              border:      'none',
              background:  canSubmit ? 'rgba(244,63,94,.85)' : 'rgba(255,255,255,.06)',
              color:       canSubmit ? '#fff' : 'var(--chalk3)',
              fontSize:    12,
              fontWeight:  700,
              cursor:      canSubmit ? 'pointer' : 'not-allowed',
              fontFamily:  'var(--font)',
              transition:  'all .15s',
            }}
          >
            {isPending ? 'Blocking…' : 'Block Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
