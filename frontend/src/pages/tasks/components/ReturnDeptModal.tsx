// ============================================================
// OPSYN — ReturnDeptModal  (Corrective Plan A.5)
// Return an external task to the previous department in routing chain.
// Pre-fetches pipeline history to show previous dept name.
// Backend: POST /{id}/return-dept  { reason }
// Visibility: external tasks, manager/team lead/admin (roleLevel >= 3)
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tasksApi } from '../../../api/tasks.api';

export interface ReturnDeptModalProps {
  taskId:    string;
  taskTitle: string;
  onConfirm: (reason: string) => void;
  onClose:   () => void;
  isPending: boolean;
}

const MIN_REASON = 10;

export function ReturnDeptModal({ taskId, taskTitle, onConfirm, onClose, isPending }: ReturnDeptModalProps) {
  const [reason,  setReason]  = useState('');
  const [touched, setTouched] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['tasks', taskId, 'pipeline-history'],
    queryFn:  () => tasksApi.getPipelineHistory(taskId),
    staleTime: 30 * 1000,
    enabled:  !!taskId,
  });

  const stages = historyData?.stages ?? [];
  const currentStage   = stages.find(s => s.is_current);
  const previousStage  = currentStage
    ? stages
        .filter(s => !s.is_current && s.routing_order === (currentStage.routing_order - 1))
        .at(0)
    : null;

  const previousDeptName = previousStage?.dept?.name ?? null;
  const canReturn        = !!previousStage;

  const reasonTrimmed = reason.trim();
  const reasonError   = touched && reasonTrimmed.length < MIN_REASON
    ? `Reason must be at least ${MIN_REASON} characters (${reasonTrimmed.length}/${MIN_REASON})`
    : null;
  const canSubmit = reasonTrimmed.length >= MIN_REASON && canReturn && !isPending;

  function handleSubmit() {
    setTouched(true);
    if (!canSubmit) return;
    onConfirm(reasonTrimmed);
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
        background: 'var(--bg2)', border: '1px solid rgba(74,222,128,.25)',
        borderRadius: 14, padding: 22, width: '100%', maxWidth: 440,
        boxShadow: '0 20px 60px rgba(0,0,0,.65)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 20 }}>↖</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--green)', letterSpacing: '-.02em' }}>
              Return to Previous Department
            </div>
            <div style={{ fontSize: 11, color: 'var(--chalk3)', marginTop: 1 }}>
              Return this task along its routing chain.
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

        {/* Previous dept info */}
        {historyLoading ? (
          <div style={{
            padding: '10px 14px', background: 'var(--bg3)', borderRadius: 8,
            fontSize: 11, color: 'var(--chalk3)', marginBottom: 14, textAlign: 'center',
          }}>
            Loading routing history…
          </div>
        ) : !canReturn ? (
          <div style={{
            padding: '10px 14px', background: 'rgba(244,63,94,.06)',
            border: '1px solid rgba(244,63,94,.25)', borderRadius: 8,
            fontSize: 11, color: 'var(--rose)', marginBottom: 14,
          }}>
            No previous department in routing chain. This task cannot be returned.
          </div>
        ) : (
          <div style={{
            padding: '10px 14px', background: 'rgba(74,222,128,.06)',
            border: '1px solid rgba(74,222,128,.2)', borderRadius: 8,
            fontSize: 11, color: 'var(--green)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 14 }}>↖</span>
            <span>Returning to: <strong>{previousDeptName ?? 'Previous department'}</strong></span>
          </div>
        )}

        {/* Reason textarea */}
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', display: 'block', marginBottom: 5 }}>
          Return Reason <span style={{ color: 'var(--rose)' }}>*</span>
        </label>
        <textarea
          ref={textareaRef}
          value={reason}
          onChange={e => setReason(e.target.value)}
          onBlur={() => setTouched(true)}
          disabled={!canReturn}
          placeholder={canReturn ? 'Explain why this task is being returned…' : 'No previous department to return to'}
          rows={3}
          style={{
            width: '100%', background: canReturn ? 'var(--bg3)' : 'var(--bg4)',
            border: `1px solid ${reasonError ? 'rgba(244,63,94,.6)' : 'var(--wire2)'}`,
            borderRadius: 8, padding: '9px 11px', color: canReturn ? 'var(--chalk)' : 'var(--chalk3)',
            fontFamily: 'var(--font)', fontSize: 12, lineHeight: 1.55,
            outline: 'none', resize: 'none', boxSizing: 'border-box',
            cursor: canReturn ? 'text' : 'not-allowed',
          }}
        />
        {reasonError && (
          <div style={{ fontSize: 10, color: 'var(--rose)', marginTop: 3 }}>{reasonError}</div>
        )}

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
            title={!canReturn ? 'No previous department in routing chain' : undefined}
            style={{
              padding: '7px 16px', borderRadius: 8, border: 'none',
              background: canSubmit ? 'rgba(74,222,128,.85)' : 'rgba(255,255,255,.06)',
              color: canSubmit ? '#050810' : 'var(--chalk3)',
              fontSize: 12, fontWeight: 700,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font)', transition: 'all .15s',
            }}
          >
            {isPending ? 'Returning…' : 'Return to Department'}
          </button>
        </div>
      </div>
    </div>
  );
}
