// ============================================================
// PUSH BACK MODAL — S2.2.5 enriched
// Reason field (text, required). Confirm disabled until filled.
// ============================================================

import { useState } from 'react';
import type { ProjectPipelineStage } from '../../../shared-types/index';

interface PushBackModalProps {
  isOpen:        boolean;
  onClose:       () => void;
  onSubmit:      (reason: string, comment?: string) => Promise<void>;
  currentStage?: ProjectPipelineStage;
  prevStage?:    ProjectPipelineStage;
}

export function PushBackModal({ isOpen, onClose, onSubmit, currentStage, prevStage }: PushBackModalProps) {
  const [reason,       setReason]       = useState('');
  const [comment,      setComment]      = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = reason.trim().length >= 10;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await onSubmit(reason.trim(), comment.trim() || undefined);
      setReason('');
      setComment('');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--bg)', border: '1px solid rgba(248,113,113,.3)',
        borderRadius: 14, padding: 24, width: 460,
        maxHeight: '85vh', overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,.5)',
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--rose)', marginBottom: 4 }}>
          Push Back Stage
        </h3>
        <p style={{ fontSize: 11, color: 'var(--chalk3)', marginBottom: 16, lineHeight: 1.5 }}>
          This will send the project back to the previous stage. Provide a clear reason.
        </p>

        {/* Current stage */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--chalk3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>
            Current Stage
          </div>
          <div style={{
            padding: '8px 12px', borderRadius: 8,
            background: 'var(--bg3)', border: '1px solid var(--wire2)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--chalk)' }}>
              {currentStage?.stageName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--chalk3)' }}>{currentStage?.departmentName}</div>
          </div>
        </div>

        {/* Return-to stage */}
        {prevStage && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--chalk3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>
              Will Return To
            </div>
            <div style={{
              padding: '8px 12px', borderRadius: 8,
              background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.25)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)' }}>
                {prevStage.stageName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--chalk3)' }}>{prevStage.departmentName}</div>
            </div>
          </div>
        )}

        {/* Reason — required */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--rose)', display: 'block', marginBottom: 6 }}>
            Reason for Push Back <span style={{ color: 'var(--rose)' }}>*</span>
            <span style={{ fontWeight: 400, color: 'var(--chalk3)', marginLeft: 6 }}>(min 10 characters)</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Describe specifically why this stage is being sent back…"
            rows={3}
            style={{
              width: '100%', padding: 10, borderRadius: 7,
              border: `1px solid ${canSubmit ? 'rgba(251,191,36,.3)' : 'var(--wire2)'}`,
              background: 'var(--bg2)', color: 'var(--chalk)',
              fontFamily: 'var(--font)', fontSize: 12,
              resize: 'vertical', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Optional comment */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk2)', display: 'block', marginBottom: 6 }}>
            Additional Notes <span style={{ fontWeight: 400, color: 'var(--chalk3)' }}>(optional)</span>
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Any supporting context or corrective action required…"
            rows={2}
            style={{
              width: '100%', padding: 10, borderRadius: 7,
              border: '1px solid var(--wire2)', background: 'var(--bg2)',
              color: 'var(--chalk)', fontFamily: 'var(--font)', fontSize: 12,
              resize: 'vertical', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              padding: '7px 14px', borderRadius: 7, fontSize: 11, fontWeight: 600,
              background: 'transparent', color: 'var(--chalk2)',
              border: '1px solid var(--wire2)', cursor: 'pointer', fontFamily: 'var(--font)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !canSubmit}
            title={!canSubmit ? 'Enter at least 10 characters for the reason' : undefined}
            style={{
              padding: '7px 16px', borderRadius: 7, fontSize: 11, fontWeight: 700,
              background: 'var(--rose)', color: '#050810', border: 'none',
              cursor: isSubmitting || !canSubmit ? 'not-allowed' : 'pointer',
              opacity: isSubmitting || !canSubmit ? 0.45 : 1,
              fontFamily: 'var(--font)',
            }}
          >
            {isSubmitting ? '…' : '← Push Back'}
          </button>
        </div>
      </div>
    </div>
  );
}
