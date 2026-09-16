// ============================================================
// OPSYN — PushBackModal  (Corrective Plan A.1)
// Mandatory rejection reason + optional recipient selector.
// Backend: POST /{id}/push-back  { reason, to_user_id? }
// Visibility: current assignee OR manager (roleLevel >= 4)
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tasksApi, type DeptStaffMember } from '../../../api/tasks.api';

export interface PushBackModalProps {
  taskId:    string;
  taskTitle: string;
  onConfirm: (reason: string, toUserId?: string) => void;
  onClose:   () => void;
  isPending: boolean;
}

const MIN_REASON = 10;

export function PushBackModal({ taskId: _taskId, taskTitle, onConfirm, onClose, isPending }: PushBackModalProps) {
  const [reason,    setReason]    = useState('');
  const [toUserId,  setToUserId]  = useState('');
  const [touched,   setTouched]   = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const { data: staffData } = useQuery({
    queryKey: ['dept-staff', 'push-back'],
    queryFn:  () => tasksApi.getDeptStaff(undefined, 100),
    staleTime: 5 * 60 * 1000,
  });

  const staffList: DeptStaffMember[] = Array.isArray(staffData) ? staffData : [];

  const reasonTrimmed = reason.trim();
  const reasonError   = touched && reasonTrimmed.length < MIN_REASON
    ? `Reason must be at least ${MIN_REASON} characters (${reasonTrimmed.length}/${MIN_REASON})`
    : null;
  const canSubmit = reasonTrimmed.length >= MIN_REASON && !isPending;

  function handleSubmit() {
    setTouched(true);
    if (!canSubmit) return;
    onConfirm(reasonTrimmed, toUserId || undefined);
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
        background: 'var(--bg2)', border: '1px solid rgba(244,63,94,.35)',
        borderRadius: 14, padding: 22, width: '100%', maxWidth: 440,
        boxShadow: '0 20px 60px rgba(0,0,0,.65)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 20 }}>↩</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--rose)', letterSpacing: '-.02em' }}>
              Push Back Task
            </div>
            <div style={{ fontSize: 11, color: 'var(--chalk3)', marginTop: 1 }}>
              Provide a mandatory reason — all parties will be notified.
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

        {/* Reason textarea */}
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', display: 'block', marginBottom: 5 }}>
          Rejection Reason <span style={{ color: 'var(--rose)' }}>*</span>
        </label>
        <textarea
          ref={textareaRef}
          value={reason}
          onChange={e => setReason(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="Describe why you are pushing this task back (minimum 10 characters)…"
          rows={4}
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

        {/* Optional: Return to specific staff member */}
        {staffList.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', display: 'block', marginBottom: 5 }}>
              Return To (optional)
            </label>
            <select
              value={toUserId}
              onChange={e => setToUserId(e.target.value)}
              style={{
                width: '100%', background: 'var(--bg3)', border: '1px solid var(--wire2)',
                borderRadius: 8, padding: '9px 11px', color: 'var(--chalk)',
                fontFamily: 'var(--font)', fontSize: 12, outline: 'none', boxSizing: 'border-box',
              }}
            >
              <option value="">Previous assignee / department default</option>
              {staffList.map(s => (
                <option key={s.user_id} value={s.user_id}>
                  {s.full_name}{s.job_title ? ` — ${s.job_title}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

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
            {isPending ? 'Pushing back…' : 'Push Back Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
