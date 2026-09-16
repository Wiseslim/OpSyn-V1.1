// ============================================================
// OPSYN — EscalateModal  (Corrective Plan A.4)
// Escalate task to department manager with mandatory note.
// Backend: POST /{id}/escalate  { note }
// Visibility: current assignee only
// ============================================================

import { useState, useEffect, useRef } from 'react';

export interface EscalateModalProps {
  taskTitle: string;
  onConfirm: (note: string) => void;
  onClose:   () => void;
  isPending: boolean;
}

const MIN_NOTE = 20;

export function EscalateModal({ taskTitle, onConfirm, onClose, isPending }: EscalateModalProps) {
  const [note,    setNote]    = useState('');
  const [touched, setTouched] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const noteTrimmed = note.trim();
  const noteError   = touched && noteTrimmed.length < MIN_NOTE
    ? `Note must be at least ${MIN_NOTE} characters (${noteTrimmed.length}/${MIN_NOTE})`
    : null;
  const canSubmit = noteTrimmed.length >= MIN_NOTE && !isPending;

  function handleSubmit() {
    setTouched(true);
    if (!canSubmit) return;
    onConfirm(noteTrimmed);
  }

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(2,4,12,.80)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div style={{
        background: 'var(--bg2)', border: '1px solid rgba(245,158,11,.35)',
        borderRadius: 14, padding: 22, width: '100%', maxWidth: 440,
        boxShadow: '0 20px 60px rgba(0,0,0,.65)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--amber)', letterSpacing: '-.02em' }}>
              Escalate to Manager
            </div>
            <div style={{ fontSize: 11, color: 'var(--chalk3)', marginTop: 1 }}>
              Your department manager will be notified with your escalation note.
            </div>
          </div>
          <button onClick={onClose} style={{
            marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--chalk3)', fontSize: 16, lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Task preview */}
        <div style={{
          padding: '8px 12px', background: 'var(--bg3)', border: '1px solid var(--wire)',
          borderRadius: 8, fontSize: 12, color: 'var(--chalk2)', marginBottom: 14,
        }}>
          {taskTitle}
        </div>

        {/* Escalation note */}
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', display: 'block', marginBottom: 5 }}>
          Escalation Note <span style={{ color: 'var(--rose)' }}>*</span>
          <span style={{ fontWeight: 400, marginLeft: 6 }}>(minimum {MIN_NOTE} characters)</span>
        </label>
        <textarea
          ref={textareaRef}
          value={note}
          onChange={e => setNote(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="Explain why this task needs manager attention. Describe the blocker, urgency, or decision needed…"
          rows={4}
          style={{
            width: '100%', background: 'var(--bg3)',
            border: `1px solid ${noteError ? 'rgba(244,63,94,.6)' : 'var(--wire2)'}`,
            borderRadius: 8, padding: '9px 11px', color: 'var(--chalk)',
            fontFamily: 'var(--font)', fontSize: 12, lineHeight: 1.55,
            outline: 'none', resize: 'none', boxSizing: 'border-box',
          }}
        />
        {noteError && (
          <div style={{ fontSize: 10, color: 'var(--rose)', marginTop: 3 }}>{noteError}</div>
        )}

        <div style={{
          marginTop: 10, padding: '8px 12px', background: 'rgba(245,158,11,.06)',
          border: '1px solid rgba(245,158,11,.2)', borderRadius: 8,
          fontSize: 11, color: 'var(--amber)', lineHeight: 1.5,
        }}>
          An escalation comment will be posted on this task and your department manager will receive an in-app notification.
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button
            onClick={onClose}
            disabled={isPending}
            style={{
              padding: '7px 14px', borderRadius: 8, border: '1px solid var(--wire2)',
              background: 'rgba(255,255,255,.04)', color: 'var(--chalk2)',
              fontSize: 12, fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              padding: '7px 16px', borderRadius: 8, border: 'none',
              background: canSubmit ? 'rgba(245,158,11,.85)' : 'rgba(255,255,255,.06)',
              color: canSubmit ? '#050810' : 'var(--chalk3)',
              fontSize: 12, fontWeight: 700,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font)', transition: 'all .15s',
            }}
          >
            {isPending ? 'Escalating…' : 'Escalate to Manager'}
          </button>
        </div>
      </div>
    </div>
  );
}
