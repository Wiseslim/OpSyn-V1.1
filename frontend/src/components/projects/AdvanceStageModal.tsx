// ============================================================
// ADVANCE STAGE MODAL — S2.2.5 enriched
// Shows from/to stage with dept + expected days.
// Final stage: confirmation language + required checkbox.
// ============================================================

import { useState } from 'react';
import type { ProjectPipelineStage } from '../../../shared-types/index';

interface AdvanceStageModalProps {
  isOpen:        boolean;
  onClose:       () => void;
  onSubmit:      (comment?: string) => Promise<void>;
  currentStage?: ProjectPipelineStage;
  nextStage?:    ProjectPipelineStage;
}

export function AdvanceStageModal({ isOpen, onClose, onSubmit, currentStage, nextStage }: AdvanceStageModalProps) {
  const [comment,       setComment]       = useState('');
  const [finalConfirm,  setFinalConfirm]  = useState(false);
  const [isSubmitting,  setIsSubmitting]  = useState(false);

  const isFinalStage = !nextStage;

  const handleSubmit = async () => {
    if (isFinalStage && !finalConfirm) return;
    setIsSubmitting(true);
    try {
      await onSubmit(comment.trim() || undefined);
      setComment('');
      setFinalConfirm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const canConfirm = isFinalStage ? finalConfirm : true;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--bg)', border: '1px solid var(--wire)',
        borderRadius: 14, padding: 24, width: 460,
        maxHeight: '85vh', overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,.5)',
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--chalk)', marginBottom: 4 }}>
          {isFinalStage ? 'Complete Pipeline' : 'Advance Stage'}
        </h3>
        {isFinalStage && (
          <p style={{ fontSize: 11, color: 'var(--amber)', marginBottom: 16, lineHeight: 1.5 }}>
            This is the final stage. Advancing will mark the project pipeline as complete.
          </p>
        )}

        {/* From stage */}
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
            <div style={{ fontSize: 11, color: 'var(--chalk3)' }}>
              {currentStage?.departmentName}
              {(currentStage as any)?.expectedDurationDays
                && ` · Est. ${(currentStage as any).expectedDurationDays}d`}
            </div>
          </div>
        </div>

        {/* To stage */}
        {!isFinalStage && nextStage && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--chalk3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>
              Next Stage
            </div>
            <div style={{
              padding: '8px 12px', borderRadius: 8,
              background: 'rgba(6,182,212,.06)', border: '1px solid rgba(6,182,212,.2)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cyan)' }}>
                {nextStage.stageName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--chalk3)' }}>
                {nextStage.departmentName}
                {(nextStage as any)?.expectedDurationDays
                  && ` · Est. ${(nextStage as any).expectedDurationDays}d`}
              </div>
            </div>
          </div>
        )}

        {/* Comment */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk2)', display: 'block', marginBottom: 6 }}>
            Comment <span style={{ fontWeight: 400, color: 'var(--chalk3)' }}>(optional)</span>
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Add a handoff note for the next stage…"
            rows={3}
            style={{
              width: '100%', padding: 10, borderRadius: 7,
              border: '1px solid var(--wire2)', background: 'var(--bg2)',
              color: 'var(--chalk)', fontFamily: 'var(--font)', fontSize: 12,
              resize: 'vertical', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Final stage checkbox */}
        {isFinalStage && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={finalConfirm}
              onChange={e => setFinalConfirm(e.target.checked)}
              style={{ width: 14, height: 14 }}
            />
            <span style={{ fontSize: 11, color: 'var(--chalk2)' }}>
              I confirm this project pipeline is complete and ready to be closed.
            </span>
          </label>
        )}

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
            disabled={isSubmitting || !canConfirm}
            style={{
              padding: '7px 16px', borderRadius: 7, fontSize: 11, fontWeight: 700,
              background: isFinalStage ? 'var(--green)' : 'var(--brand)',
              color: '#050810', border: 'none',
              cursor: isSubmitting || !canConfirm ? 'not-allowed' : 'pointer',
              opacity: isSubmitting || !canConfirm ? 0.5 : 1,
              fontFamily: 'var(--font)',
            }}
          >
            {isSubmitting ? '…' : isFinalStage ? 'Complete Pipeline' : 'Advance Stage →'}
          </button>
        </div>
      </div>
    </div>
  );
}
