// ============================================================
// OPSYN — ActivityTimeline
// Unified chronological feed for tasks, projects, outages,
// and onboarding requests. Blueprint Section 4 + 15.2.
// ============================================================

import React, { useState } from 'react';
import type { TimelineEntityType } from './types';
import { TimelineEvent } from './TimelineEvent';
import { TimelineCommentForm } from './TimelineCommentForm';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';
import {
  useTaskTimeline,
  useProjectTimeline,
  useOutageTimeline,
  useOnboardingTimeline,
} from '../../hooks/index';

// ── Props ─────────────────────────────────────────────────────

export interface ActivityTimelineProps {
  entityType:   TimelineEntityType;
  entityId:     string;
  canComment?:  boolean;
  maxHeight?:   number | string;
  showFilter?:  boolean;
  style?:       React.CSSProperties;
}

// ── Hook selector by entity type ─────────────────────────────

function useTimeline(entityType: TimelineEntityType, entityId: string) {
  const task       = useTaskTimeline(entityType === 'task'       ? entityId : undefined);
  const project    = useProjectTimeline(entityType === 'project' ? entityId : undefined);
  const outage     = useOutageTimeline(entityType === 'outage'   ? entityId : undefined);
  const onboarding = useOnboardingTimeline(entityType === 'onboarding' ? entityId : undefined);

  const map = { task, project, outage, onboarding };
  return map[entityType];
}

// ── Main component ────────────────────────────────────────────

export function ActivityTimeline({
  entityType,
  entityId,
  canComment  = false,
  maxHeight,
  showFilter  = false,
  style,
}: ActivityTimelineProps) {
  const [replyToId, setReplyToId]       = useState<string | null>(null);
  const [replyToActor, setReplyToActor] = useState<string | null>(null);
  const [filterType, setFilterType]     = useState<string>('all');

  const { data: rawEntries = [], isLoading, error, refetch } = useTimeline(entityType, entityId);

  // Group threaded replies under their parent
  const entries = React.useMemo(() => {
    const topLevel = rawEntries.filter(e => !e.parent_id);
    const byParent: Record<string, typeof rawEntries> = {};
    rawEntries.filter(e => e.parent_id).forEach(r => {
      if (!byParent[r.parent_id!]) byParent[r.parent_id!] = [];
      byParent[r.parent_id!].push(r);
    });
    return topLevel.map(e => ({
      ...e,
      replies: byParent[e.id] ?? e.replies ?? [],
    }));
  }, [rawEntries]);

  // Apply event-type filter
  const filtered = filterType === 'all'
    ? entries
    : entries.filter(e =>
        filterType === 'comments' ? e.event_type === 'user_comment' : e.is_system
      );

  const handleReply = (parentId: string) => {
    const parent = entries.find(e => e.id === parentId);
    setReplyToId(parentId);
    setReplyToActor(parent?.actor_label ?? null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, ...style }}>

      {/* Header */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        marginBottom:   14,
        flexWrap:       'wrap',
        gap:            8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk2)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Activity
          </span>
          {rawEntries.length > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: 'var(--chalk3)', background: 'var(--bg4)',
              padding: '1px 6px', borderRadius: 4,
            }}>
              {rawEntries.length}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          {showFilter && (['all', 'comments', 'system'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              style={{
                background:   filterType === f ? 'var(--bg3)' : 'transparent',
                border:       '1px solid ' + (filterType === f ? 'var(--wire2)' : 'transparent'),
                borderRadius: 'var(--r)',
                padding:      '3px 8px',
                color:        filterType === f ? 'var(--chalk)' : 'var(--chalk3)',
                fontSize:     10,
                fontWeight:   600,
                cursor:       'pointer',
                fontFamily:   'var(--font)',
                textTransform:'capitalize',
              }}
            >
              {f}
            </button>
          ))}
          <button
            onClick={() => refetch()}
            title="Refresh timeline"
            style={{
              background: 'none', border: 'none',
              color: 'var(--chalk3)', fontSize: 12,
              cursor: 'pointer', padding: '2px 6px',
            }}
          >
            ↻
          </button>
        </div>
      </div>

      {/* Comment form at top if canComment */}
      {canComment && (
        <div style={{ marginBottom: 16 }}>
          <TimelineCommentForm
            entityType={entityType}
            entityId={entityId}
            replyToId={replyToId}
            replyToActor={replyToActor}
            onCancelReply={() => { setReplyToId(null); setReplyToActor(null); }}
          />
        </div>
      )}

      {/* Feed */}
      <div style={{
        display:    'flex',
        flexDirection:'column',
        gap:        12,
        overflowY:  maxHeight ? 'auto' : undefined,
        maxHeight,
        paddingRight: maxHeight ? 4 : undefined,
      }}>
        {isLoading ? (
          <Spinner center size="md" />
        ) : error ? (
          <EmptyState
            icon="⚠"
            title="Failed to load timeline"
            message="Could not fetch activity. Click to retry."
            action={{ label: 'Retry', onClick: () => refetch() }}
            size="sm"
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="📋"
            title="No activity yet"
            message={canComment ? 'Be the first to add a work log entry.' : 'Activity will appear here as work progresses.'}
            size="sm"
          />
        ) : (
          filtered.map(entry => (
            <TimelineEvent
              key={entry.id}
              entry={entry}
              onReply={handleReply}
            />
          ))
        )}
      </div>
    </div>
  );
}
