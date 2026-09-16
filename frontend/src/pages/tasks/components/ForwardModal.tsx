// ============================================================
// OPSYN — ForwardModal  (Corrective Plan A.2)
// Forward internal task to another staff member in same dept.
// Backend: POST /{id}/forward  { to_user_id, note? }
// Visibility: internal task, current assignee OR manager/lead
// ============================================================

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tasksApi, type DeptStaffMember } from '../../../api/tasks.api';

export interface ForwardModalProps {
  taskTitle:       string;
  currentUserId:   string;
  onConfirm:       (toUserId: string, note?: string) => void;
  onClose:         () => void;
  isPending:       boolean;
}

export function ForwardModal({ taskTitle, currentUserId, onConfirm, onClose, isPending }: ForwardModalProps) {
  const [toUserId, setToUserId] = useState('');
  const [note,     setNote]     = useState('');
  const [search,   setSearch]   = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const { data: staffData, isLoading } = useQuery({
    queryKey: ['dept-staff', 'forward', search],
    queryFn:  () => tasksApi.getDeptStaff(search || undefined, 50),
    staleTime: 30 * 1000,
  });

  const staffList: DeptStaffMember[] = (Array.isArray(staffData) ? staffData : [])
    .filter(s => s.user_id !== currentUserId);

  const canSubmit = !!toUserId && !isPending;

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
        background: 'var(--bg2)', border: '1px solid rgba(99,190,255,.25)',
        borderRadius: 14, padding: 22, width: '100%', maxWidth: 440,
        boxShadow: '0 20px 60px rgba(0,0,0,.65)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 20 }}>→</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)', letterSpacing: '-.02em' }}>
              Forward Task to Staff
            </div>
            <div style={{ fontSize: 11, color: 'var(--chalk3)', marginTop: 1 }}>
              Reassign this task to another staff member in your department.
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

        {/* Staff search */}
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', display: 'block', marginBottom: 5 }}>
          Search Staff <span style={{ color: 'var(--rose)' }}>*</span>
        </label>
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setToUserId(''); }}
          placeholder="Type name to search…"
          style={{
            width: '100%', background: 'var(--bg3)', border: '1px solid var(--wire2)',
            borderRadius: 8, padding: '9px 11px', color: 'var(--chalk)',
            fontFamily: 'var(--font)', fontSize: 12, outline: 'none', boxSizing: 'border-box',
            marginBottom: 8,
          }}
        />

        {/* Staff list */}
        <div style={{
          maxHeight: 180, overflowY: 'auto', scrollbarWidth: 'none',
          border: '1px solid var(--wire2)', borderRadius: 8,
        }}>
          {isLoading ? (
            <div style={{ padding: '12px 14px', fontSize: 11, color: 'var(--chalk3)', textAlign: 'center' }}>
              Loading staff…
            </div>
          ) : staffList.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 11, color: 'var(--chalk3)', textAlign: 'center' }}>
              No staff found.
            </div>
          ) : (
            staffList.map(s => (
              <div
                key={s.user_id}
                onClick={() => setToUserId(s.user_id)}
                style={{
                  padding: '9px 14px', cursor: 'pointer', fontSize: 12,
                  background: toUserId === s.user_id ? 'rgba(99,190,255,.12)' : 'transparent',
                  borderBottom: '1px solid var(--wire)',
                  color: 'var(--chalk)',
                  display: 'flex', alignItems: 'center', gap: 10,
                  transition: 'background .1s',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: toUserId === s.user_id ? 'var(--brand)' : 'var(--bg4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700,
                  color: toUserId === s.user_id ? '#050810' : 'var(--chalk3)',
                }}>
                  {(s.first_name[0] ?? '') + (s.last_name[0] ?? '')}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{s.full_name}</div>
                  {s.job_title && (
                    <div style={{ fontSize: 10, color: 'var(--chalk3)' }}>{s.job_title}</div>
                  )}
                </div>
                {toUserId === s.user_id && (
                  <span style={{ marginLeft: 'auto', color: 'var(--brand)', fontSize: 14 }}>✓</span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Optional note */}
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', display: 'block', marginBottom: 5 }}>
            Note (optional)
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Add context for the new assignee…"
            rows={2}
            style={{
              width: '100%', background: 'var(--bg3)', border: '1px solid var(--wire2)',
              borderRadius: 8, padding: '9px 11px', color: 'var(--chalk)',
              fontFamily: 'var(--font)', fontSize: 12, lineHeight: 1.55,
              outline: 'none', resize: 'none', boxSizing: 'border-box',
            }}
          />
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
            onClick={() => canSubmit && onConfirm(toUserId, note.trim() || undefined)}
            disabled={!canSubmit}
            style={{
              padding: '7px 16px', borderRadius: 8, border: 'none',
              background: canSubmit ? 'rgba(99,190,255,.85)' : 'rgba(255,255,255,.06)',
              color: canSubmit ? '#050810' : 'var(--chalk3)',
              fontSize: 12, fontWeight: 700,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font)', transition: 'all .15s',
            }}
          >
            {isPending ? 'Forwarding…' : 'Forward Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
