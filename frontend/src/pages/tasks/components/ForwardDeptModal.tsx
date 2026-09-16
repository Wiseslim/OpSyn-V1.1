// ============================================================
// OPSYN — ForwardDeptModal  (Corrective Plan A.3)
// Forward external task to another department.
// Backend: POST /{id}/forward-dept  { to_dept_id, note? }
// Visibility: external tasks only, current assignee/manager/lead/admin
// ============================================================

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { orgApi } from '../../../api/index';
import type { Department } from '../../../../shared-types/index';

export interface ForwardDeptModalProps {
  taskTitle:       string;
  currentDeptId:   string;
  onConfirm:       (toDeptId: string, note?: string) => void;
  onClose:         () => void;
  isPending:       boolean;
}

export function ForwardDeptModal({ taskTitle, currentDeptId, onConfirm, onClose, isPending }: ForwardDeptModalProps) {
  const [toDeptId, setToDeptId] = useState('');
  const [note,     setNote]     = useState('');
  const [search,   setSearch]   = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const { data: depts = [], isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn:  () => orgApi.getDepartments(),
    staleTime: 5 * 60 * 1000,
  });

  const filtered = (depts as Department[]).filter(d =>
    d.id !== currentDeptId &&
    (!search || (d.name ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  const selectedDept = (depts as Department[]).find(d => d.id === toDeptId);
  const canSubmit    = !!toDeptId && !isPending;

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
        background: 'var(--bg2)', border: '1px solid rgba(245,158,11,.3)',
        borderRadius: 14, padding: 22, width: '100%', maxWidth: 440,
        boxShadow: '0 20px 60px rgba(0,0,0,.65)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 20 }}>🏢</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--amber)', letterSpacing: '-.02em' }}>
              Forward to Department
            </div>
            <div style={{ fontSize: 11, color: 'var(--chalk3)', marginTop: 1 }}>
              Route this external task to another department's inbox.
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

        {/* Department search */}
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', display: 'block', marginBottom: 5 }}>
          Target Department <span style={{ color: 'var(--rose)' }}>*</span>
        </label>
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setToDeptId(''); }}
          placeholder="Search departments…"
          style={{
            width: '100%', background: 'var(--bg3)', border: '1px solid var(--wire2)',
            borderRadius: 8, padding: '9px 11px', color: 'var(--chalk)',
            fontFamily: 'var(--font)', fontSize: 12, outline: 'none', boxSizing: 'border-box',
            marginBottom: 8,
          }}
        />

        {/* Department list */}
        <div style={{
          maxHeight: 180, overflowY: 'auto', scrollbarWidth: 'none',
          border: '1px solid var(--wire2)', borderRadius: 8,
        }}>
          {isLoading ? (
            <div style={{ padding: '12px 14px', fontSize: 11, color: 'var(--chalk3)', textAlign: 'center' }}>
              Loading departments…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 11, color: 'var(--chalk3)', textAlign: 'center' }}>
              No departments found.
            </div>
          ) : (
            filtered.map(d => (
              <div
                key={d.id}
                onClick={() => setToDeptId(d.id)}
                style={{
                  padding: '9px 14px', cursor: 'pointer', fontSize: 12,
                  background: toDeptId === d.id ? 'rgba(245,158,11,.12)' : 'transparent',
                  borderBottom: '1px solid var(--wire)',
                  color: 'var(--chalk)',
                  display: 'flex', alignItems: 'center', gap: 10,
                  transition: 'background .1s',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{d.name}</div>
                </div>
                {toDeptId === d.id && (
                  <span style={{ marginLeft: 'auto', color: 'var(--amber)', fontSize: 14 }}>✓</span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Selected confirmation */}
        {selectedDept && (
          <div style={{
            marginTop: 8, padding: '7px 12px', background: 'rgba(245,158,11,.08)',
            border: '1px solid rgba(245,158,11,.25)', borderRadius: 8,
            fontSize: 11, color: 'var(--amber)',
          }}>
            Routing to: <strong>{selectedDept.name}</strong>. Their department inbox will be notified.
          </div>
        )}

        {/* Optional note */}
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', display: 'block', marginBottom: 5 }}>
            Routing Note (optional)
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Provide context for the receiving department…"
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
            onClick={() => canSubmit && onConfirm(toDeptId, note.trim() || undefined)}
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
            {isPending ? 'Routing…' : 'Send to Department'}
          </button>
        </div>
      </div>
    </div>
  );
}
