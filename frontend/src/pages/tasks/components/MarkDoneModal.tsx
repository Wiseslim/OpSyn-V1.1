// ============================================================
// OPSYN — MarkDoneModal
// Explicit Done / approval confirmation modal. Blueprint §2.2.
// ============================================================

import { useEffect } from 'react';

export interface MarkDoneModalProps {
  taskTitle:  string;
  onConfirm:  () => void;
  onClose:    () => void;
  isPending:  boolean;
}

export function MarkDoneModal({ taskTitle, onConfirm, onClose, isPending }: MarkDoneModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

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
        border:       '1px solid rgba(74,222,128,.3)',
        borderRadius: 14,
        padding:      22,
        width:        '100%',
        maxWidth:     400,
        boxShadow:    '0 20px 60px rgba(0,0,0,.65)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 22 }}>✅</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--green)', letterSpacing: '-.02em' }}>
              Mark as Done
            </div>
            <div style={{ fontSize: 11, color: 'var(--chalk3)', marginTop: 1 }}>
              Confirm completion of this task.
            </div>
          </div>
        </div>

        {/* Task title */}
        <div style={{
          padding:      '10px 12px',
          background:   'var(--bg3)',
          border:       '1px solid var(--wire)',
          borderRadius: 8,
          fontSize:     12,
          color:        'var(--chalk)',
          lineHeight:   1.45,
          marginBottom: 16,
        }}>
          {taskTitle}
        </div>

        <div style={{ fontSize: 11, color: 'var(--chalk3)', marginBottom: 16, lineHeight: 1.5 }}>
          This will move the task to <strong style={{ color: 'var(--green)' }}>Done</strong>.
          The action is recorded in the audit trail and the activity timeline.
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
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
            onClick={() => !isPending && onConfirm()}
            disabled={isPending}
            style={{
              padding:     '7px 16px',
              borderRadius: 8,
              border:      'none',
              background:  isPending ? 'rgba(255,255,255,.06)' : 'rgba(74,222,128,.85)',
              color:       isPending ? 'var(--chalk3)' : '#050810',
              fontSize:    12,
              fontWeight:  700,
              cursor:      isPending ? 'not-allowed' : 'pointer',
              fontFamily:  'var(--font)',
              transition:  'all .15s',
            }}
          >
            {isPending ? 'Completing…' : 'Confirm Done'}
          </button>
        </div>
      </div>
    </div>
  );
}
