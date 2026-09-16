// ============================================================
// OPSYN — AdminDeleteModal  (Corrective Plan B.1)
// Admin task deletion governance: mandatory reason + typed CONFIRM.
// Backend: DELETE /{id}  { reason }  (soft-delete, role >= 4)
// Visibility: admin users (roleLevel >= 4) AND task.is_deleted === false
// ============================================================

import { useState, useEffect, useRef } from 'react';

export interface AdminDeleteModalProps {
  taskId:       string;
  taskTitle:    string;
  ticketNumber: string | null;
  deptName:     string | null;
  onConfirm:    (reason: string) => void;
  onClose:      () => void;
  isPending:    boolean;
}

const CONFIRM_PHRASE = 'CONFIRM';
const MIN_REASON     = 20;

export function AdminDeleteModal({
  taskId: _taskId,
  taskTitle,
  ticketNumber,
  deptName,
  onConfirm,
  onClose,
  isPending,
}: AdminDeleteModalProps) {
  const [reason,        setReason]        = useState('');
  const [confirmText,   setConfirmText]   = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    reasonRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const reasonTrimmed   = reason.trim();
  const reasonError     = reasonTouched && reasonTrimmed.length < MIN_REASON
    ? `Reason must be at least ${MIN_REASON} characters (${reasonTrimmed.length}/${MIN_REASON})`
    : null;
  const confirmMatches  = confirmText === CONFIRM_PHRASE;
  const canSubmit       = reasonTrimmed.length >= MIN_REASON && confirmMatches && !isPending;

  function handleSubmit() {
    setReasonTouched(true);
    if (!canSubmit) return;
    onConfirm(reasonTrimmed);
  }

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(2,4,12,.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div style={{
        background: 'var(--bg2)', border: '2px solid rgba(244,63,94,.4)',
        borderRadius: 14, padding: 24, width: '100%', maxWidth: 460,
        boxShadow: '0 24px 64px rgba(0,0,0,.75)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'rgba(244,63,94,.12)', border: '1px solid rgba(244,63,94,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>
            🗑️
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--rose)', letterSpacing: '-.02em' }}>
              Delete Task
            </div>
            <div style={{ fontSize: 11, color: 'var(--chalk3)', marginTop: 1 }}>
              This action is logged. The department manager will be notified.
            </div>
          </div>
        </div>

        {/* Task info summary */}
        <div style={{
          padding: '12px 14px', background: 'var(--bg3)', border: '1px solid var(--wire)',
          borderRadius: 8, marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {ticketNumber && (
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700,
                color: 'var(--brand)', letterSpacing: '0.06em',
                padding: '2px 6px', borderRadius: 4,
                background: 'rgba(0,200,150,.08)', border: '1px solid rgba(0,200,150,.2)',
              }}>
                {ticketNumber}
              </span>
            )}
            {deptName && (
              <span style={{ fontSize: 10, color: 'var(--chalk3)' }}>{deptName}</span>
            )}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--chalk)', lineHeight: 1.4 }}>
            {taskTitle}
          </div>
        </div>

        {/* Mandatory reason */}
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', display: 'block', marginBottom: 5 }}>
          Deletion Reason <span style={{ color: 'var(--rose)' }}>*</span>
          <span style={{ fontWeight: 400, marginLeft: 6 }}>(minimum {MIN_REASON} characters)</span>
        </label>
        <textarea
          ref={reasonRef}
          value={reason}
          onChange={e => setReason(e.target.value)}
          onBlur={() => setReasonTouched(true)}
          placeholder="Provide a detailed reason for deleting this task. This is stored in the audit log…"
          rows={3}
          style={{
            width: '100%', background: 'var(--bg3)',
            border: `1px solid ${reasonError ? 'rgba(244,63,94,.6)' : 'var(--wire2)'}`,
            borderRadius: 8, padding: '9px 11px', color: 'var(--chalk)',
            fontFamily: 'var(--font)', fontSize: 12, lineHeight: 1.55,
            outline: 'none', resize: 'none', boxSizing: 'border-box',
          }}
        />
        {reasonError && (
          <div style={{ fontSize: 10, color: 'var(--rose)', marginTop: 3 }}>{reasonError}</div>
        )}

        {/* Typed confirmation */}
        <div style={{ marginTop: 14 }}>
          <label style={{
            fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', display: 'block', marginBottom: 5,
          }}>
            Type <span style={{
              fontFamily: 'var(--mono)', color: 'var(--rose)', fontWeight: 800,
              padding: '1px 5px', background: 'rgba(244,63,94,.1)', borderRadius: 4,
            }}>CONFIRM</span> to proceed
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="Type CONFIRM"
            autoCapitalize="none"
            style={{
              width: '100%', background: 'var(--bg3)',
              border: `1px solid ${confirmText && !confirmMatches ? 'rgba(244,63,94,.5)' : confirmMatches ? 'rgba(74,222,128,.5)' : 'var(--wire2)'}`,
              borderRadius: 8, padding: '9px 11px', color: 'var(--chalk)',
              fontFamily: 'var(--mono)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
              letterSpacing: '0.04em',
            }}
          />
          {confirmText && !confirmMatches && (
            <div style={{ fontSize: 10, color: 'var(--rose)', marginTop: 3 }}>
              Type exactly: CONFIRM
            </div>
          )}
        </div>

        {/* Warning notice */}
        <div style={{
          marginTop: 12, padding: '8px 12px', background: 'rgba(244,63,94,.06)',
          border: '1px solid rgba(244,63,94,.2)', borderRadius: 8,
          fontSize: 11, color: 'var(--rose)', lineHeight: 1.5,
        }}>
          ⚠ The task will be soft-deleted. The department manager will receive an in-app notification. Admins can restore it from the Deleted Tasks page.
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
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
              background: canSubmit ? 'rgba(244,63,94,.85)' : 'rgba(255,255,255,.06)',
              color: canSubmit ? '#fff' : 'var(--chalk3)',
              fontSize: 12, fontWeight: 700,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font)', transition: 'all .15s',
            }}
          >
            {isPending ? 'Deleting…' : '🗑 Delete Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
