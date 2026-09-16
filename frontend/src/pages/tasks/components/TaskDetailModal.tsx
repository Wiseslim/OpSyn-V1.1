// ============================================================
// OPSYN TASK DETAIL MODAL — v5 Explicit Actions Edition
// • 7-state pipeline stepper with canMove() validation
// • All transitions via explicit UI buttons (no keyword triggers)
// • Comments are pure work logs (NORMAL + ACTION types only)
// • BlockReasonModal for blocked transitions
// • MarkDoneModal for done transitions
// • ActivityTimeline unified feed on Overview tab
// Blueprint §2.2, §4, §15.2
// ============================================================

import { useState, useEffect, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi, taskCommentsApi, taskAuditApi } from '../../../api/tasks.api';
import { useUIStore } from '../../../store/ui.store';
import { useAuthStore } from '../../../store/auth.store';
import { usePermissions } from '../../../hooks/usePermissions';
import {
  PIPELINE_FLOW,
  STATE_LABELS,
  STATE_COLORS,
  TRANSITIONS,
  canMove,
  getForwardMoves,
  getBackwardMoves,
  getSideMoves,
  stateFlowIndex,
} from '../../../lib/taskStateMachine';
import {
  hasUnresolvedActionComments,
  COMMENT_TYPE_META,
  extractMentions,
} from '../../../lib/commentWorkflow';
import { BlockReasonModal }  from './BlockReasonModal';
import { MarkDoneModal }     from './MarkDoneModal';
import { PushBackModal }     from './PushBackModal';
import { ForwardModal }      from './ForwardModal';
import { ForwardDeptModal }  from './ForwardDeptModal';
import { EscalateModal }     from './EscalateModal';
import { ReturnDeptModal }   from './ReturnDeptModal';
import { AdminDeleteModal }  from './AdminDeleteModal';
import { ActivityTimeline } from '../../../components/timeline';
import { ErrorBoundary }   from '../../../components/ErrorBoundary';
import type {
  Task,
  TaskComment,
  TaskAuditEntry,
  TaskStatus,
  CommentType,
  TaskDependency,
  TransitionRequest,
  AddCommentRequest,
} from '../../../../shared-types/index';

// ── Constants ────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'var(--rose)',
  high:     'var(--amber)',
  medium:   'var(--cyan)',
  low:      'var(--green)',
};

const TABS = ['Overview', 'Comments', 'Dependencies', 'History'] as const;
type Tab = typeof TABS[number];

// ── Sub-components ───────────────────────────────────────────

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0] ?? '').slice(0, 2).join('').toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--brand)', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 800, color: '#050810',
    }}>
      {initials}
    </div>
  );
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600,
      color, background: bg,
    }}>
      {label}
    </span>
  );
}

// ── Pipeline Stepper ─────────────────────────────────────────

function PipelineStepper({
  status,
  isPending,
  blockedReason,
}: {
  status: TaskStatus;
  isPending: boolean;
  blockedReason?: string;
}) {
  const currentIdx = stateFlowIndex(status);
  const isBlocked  = status === 'blocked';

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'var(--chalk3)',
        textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 10,
      }}>
        Pipeline
      </div>

      {isBlocked && (
        <div style={{
          padding: '8px 12px', borderRadius: 8, marginBottom: 10,
          background: 'rgba(244,63,94,.1)', border: '1px solid rgba(244,63,94,.3)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 14 }}>🚫</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--rose)' }}>BLOCKED</div>
            {blockedReason && (
              <div style={{ fontSize: 10, color: 'var(--chalk3)', marginTop: 2 }}>{blockedReason}</div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {PIPELINE_FLOW.map((stage, i) => {
          const stageIdx  = stateFlowIndex(stage);
          const isCurrent = stage === status;
          const isPast    = !isBlocked && stageIdx < currentIdx;
          const color     = STATE_COLORS[stage];

          return (
            <Fragment key={stage}>
              {i > 0 && (
                <div style={{
                  flex: 1, height: 2, marginTop: 15,
                  background: isPast || (isCurrent && !isBlocked) ? 'var(--cyan)' : 'var(--wire2)',
                  transition: 'background .3s',
                }} />
              )}
              <div
                title={STATE_LABELS[stage]}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 5, minWidth: 56,
                  opacity: isPending ? 0.6 : 1,
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, transition: 'all .25s',
                  border:     isCurrent ? `2px solid ${color}`
                            : isPast    ? '2px solid var(--green)'
                            :             '2px solid var(--wire2)',
                  background: isCurrent ? `${color}22`
                            : isPast    ? 'rgba(74,222,128,.1)'
                            :             'var(--bg3)',
                  color:      isCurrent ? color
                            : isPast    ? 'var(--green)'
                            :             'var(--chalk3)',
                  boxShadow:  isCurrent ? `0 0 14px ${color}44` : 'none',
                }}>
                  {isPast ? '✓' : i + 1}
                </div>
                <div style={{
                  fontSize: 9, whiteSpace: 'nowrap', fontWeight: isCurrent ? 700 : 400,
                  color: isCurrent ? color : isPast ? 'var(--green)' : 'var(--chalk3)',
                }}>
                  {STATE_LABELS[stage]}
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ── Action Buttons ────────────────────────────────────────────
// Explicit primary CTA row — replaces comment-keyword triggers.

function ActionButtons({
  status,
  task,
  dependencies,
  unresolvedActions,
  user,
  isPending,
  canApprove,
  onMove,
}: {
  status:            TaskStatus;
  task:              Task;
  dependencies:      TaskDependency[];
  unresolvedActions: boolean;
  user:              ReturnType<typeof useAuthStore>['user'];
  isPending:         boolean;
  canApprove:        boolean;
  onMove:            (to: TaskStatus) => void;
}) {
  if (!user || status === 'archived') return null;

  const checkMove = (to: TaskStatus) =>
    canMove({ task: { ...task, dependencies }, fromStatus: status, toStatus: to, user, hasUnresolvedActions: unresolvedActions });

  const btn = (
    to: TaskStatus,
    label: string,
    style: React.CSSProperties,
    guard?: boolean,
  ) => {
    const result = checkMove(to);
    const allowed = result.allowed && guard !== false;
    return (
      <button
        key={to}
        onClick={() => allowed && !isPending && onMove(to)}
        disabled={!allowed || isPending}
        title={!allowed ? (result.reason ?? 'Not allowed') : undefined}
        style={{
          padding:     '6px 14px',
          borderRadius: 8,
          border:      'none',
          fontSize:    11,
          fontWeight:  700,
          cursor:      allowed && !isPending ? 'pointer' : 'not-allowed',
          fontFamily:  'var(--font)',
          opacity:     allowed && !isPending ? 1 : 0.4,
          transition:  'all .15s',
          ...style,
        }}
      >
        {isPending ? '…' : label}
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
      {/* Start Work */}
      {(status === 'new' || status === 'assigned') &&
        btn('in_progress', '▶ Start Work', { background: 'rgba(6,182,212,.15)', color: 'var(--brand)' })}

      {/* Submit for Review */}
      {status === 'in_progress' &&
        btn('review', '↑ Submit for Review', { background: 'rgba(251,191,36,.12)', color: 'var(--amber)' })}

      {/* Approve / Mark Done */}
      {status === 'review' && canApprove &&
        btn('done', '✓ Mark Done', { background: 'rgba(74,222,128,.15)', color: 'var(--green)' })}

      {/* Reject back to In Progress */}
      {status === 'review' && canApprove &&
        btn('in_progress', '✕ Reject', { background: 'rgba(244,63,94,.1)', color: 'var(--rose)' })}

      {/* Unblock */}
      {status === 'blocked' &&
        btn('in_progress', '↩ Resume Work', { background: 'rgba(74,222,128,.1)', color: 'var(--green)' })}

      {/* Archive (done tasks) */}
      {status === 'done' && canApprove &&
        btn('archived', '📦 Archive', { background: 'rgba(255,255,255,.05)', color: 'var(--chalk3)' })}

      {/* Mark Blocked — available from several states */}
      {status !== 'blocked' && status !== 'done' && status !== 'archived' &&
        btn('blocked', '🚫 Mark Blocked', { background: 'rgba(244,63,94,.08)', color: 'var(--rose)' })}

      {/* Back moves */}
      {getBackwardMoves(status).map(s =>
        btn(s, `← ${STATE_LABELS[s]}`, { background: 'rgba(255,255,255,.04)', color: 'var(--chalk3)', border: '1px solid var(--wire2)' })
      )}
    </div>
  );
}

// ── Comment Thread ───────────────────────────────────────────

function CommentBubble({
  comment,
  onReply,
  onResolve,
  canResolve,
}: {
  comment:    TaskComment;
  onReply:    (parentId: string) => void;
  onResolve:  (commentId: string) => void;
  canResolve: boolean;
}) {
  const meta    = COMMENT_TYPE_META[comment.type ?? 'NORMAL'];
  const isSystem = comment.type === 'SYSTEM';

  if (isSystem) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', margin: '4px 0',
        background: 'var(--bg2)', borderRadius: 6,
        borderLeft: '2px solid var(--wire2)',
      }}>
        <span style={{ fontSize: 12 }}>⚙</span>
        <span style={{ fontSize: 11, color: 'var(--chalk3)', fontStyle: 'italic', flex: 1 }}>
          {comment.body}
        </span>
        <span style={{ fontSize: 10, color: 'var(--chalk3)', flexShrink: 0 }}>
          {new Date(comment.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    );
  }

  return (
    <div style={{
      marginBottom: 8, borderRadius: 10,
      background: meta.bg,
      border: `1px solid ${meta.color}22`,
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px 6px' }}>
        <Avatar name={comment.author.full_name} size={22} />
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk)' }}>
          {comment.author.full_name}
        </span>
        <span style={{
          fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 700,
          color: meta.color, background: `${meta.color}22`,
        }}>
          {meta.icon} {meta.label}
        </span>
        {comment.is_resolved && (
          <span style={{ fontSize: 9, color: 'var(--green)', marginLeft: 'auto' }}>✓ resolved</span>
        )}
        <span style={{
          fontSize: 10, color: 'var(--chalk3)',
          marginLeft: comment.is_resolved ? 0 : 'auto',
        }}>
          {new Date(comment.created_at).toLocaleString('en-GB', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
          })}
        </span>
      </div>

      <div style={{ padding: '0 12px 8px', fontSize: 12, color: 'var(--chalk2)', lineHeight: 1.55 }}>
        {comment.body}
      </div>

      {comment.mentions && comment.mentions.length > 0 && (
        <div style={{ padding: '0 12px 6px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {comment.mentions.map(m => (
            <span key={m} style={{
              fontSize: 10, color: 'var(--brand)',
              background: 'rgba(99,190,255,.1)', padding: '1px 5px', borderRadius: 4,
            }}>
              @{m}
            </span>
          ))}
        </div>
      )}

      <div style={{ padding: '0 12px 8px', display: 'flex', gap: 6, alignItems: 'center' }}>
        {comment.type === 'ACTION' && !comment.is_resolved && canResolve && (
          <button onClick={() => onResolve(comment.id)}
            style={{
              padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              background: 'rgba(245,158,11,.1)', color: 'var(--amber)',
              border: '1px solid rgba(245,158,11,.3)', fontFamily: 'var(--font)',
            }}>
            ✓ Mark Resolved
          </button>
        )}
        <button onClick={() => onReply(comment.id)}
          style={{
            marginLeft: 'auto', padding: '3px 8px', borderRadius: 6, fontSize: 10,
            cursor: 'pointer', background: 'none', color: 'var(--chalk3)',
            border: '1px solid var(--wire2)', fontFamily: 'var(--font)',
          }}>
          ↩ Reply
        </button>
      </div>

      {comment.replies && comment.replies.length > 0 && (
        <div style={{
          margin: '0 12px 8px 32px',
          padding: '8px 10px', borderRadius: 8,
          background: 'rgba(0,0,0,.15)',
          borderLeft: `2px solid ${meta.color}44`,
        }}>
          {comment.replies.map(reply => (
            <div key={reply.id} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <Avatar name={reply.author.full_name} size={18} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--chalk2)' }}>
                  {reply.author.full_name}
                </span>
                <span style={{ fontSize: 10, color: 'var(--chalk3)', marginLeft: 'auto' }}>
                  {new Date(reply.created_at).toLocaleString('en-GB', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--chalk2)', lineHeight: 1.5, paddingLeft: 24 }}>
                {reply.body}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Dependency Panel ─────────────────────────────────────────

function DependencyPanel({ dependencies }: { dependencies: TaskDependency[] }) {
  if (dependencies.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--chalk3)', fontSize: 12 }}>
        No blocking dependencies.
      </div>
    );
  }

  return (
    <div>
      {dependencies.map(dep => {
        const dep_task = dep.depends_on_task;
        const isDone   = dep_task?.status === 'done';
        const color    = isDone ? 'var(--green)' : 'var(--rose)';
        return (
          <div key={dep.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', marginBottom: 6, borderRadius: 8,
            background: isDone ? 'rgba(74,222,128,.06)' : 'rgba(244,63,94,.06)',
            border: `1px solid ${color}22`,
          }}>
            <span style={{ fontSize: 14 }}>{isDone ? '✓' : '⚠'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--chalk)' }}>
                {dep_task?.title ?? dep.depends_on_task_id}
              </div>
              <div style={{ fontSize: 10, color: 'var(--chalk3)', marginTop: 2 }}>
                {dep_task?.assignee ? `Assigned: ${dep_task.assignee.full_name} · ` : ''}
                Status: {dep_task ? STATE_LABELS[dep_task.status] : 'Unknown'}
              </div>
            </div>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
              color, background: `${color}18`,
            }}>
              {isDone ? 'DONE' : 'PENDING'}
            </span>
          </div>
        );
      })}
      {dependencies.some(d => d.depends_on_task?.status !== 'done') && (
        <div style={{
          marginTop: 10, padding: '8px 12px', borderRadius: 8,
          background: 'rgba(244,63,94,.06)', border: '1px solid rgba(244,63,94,.2)',
          fontSize: 11, color: 'var(--rose)',
        }}>
          ⚠ This task cannot start until all dependencies are completed.
        </div>
      )}
    </div>
  );
}

// ── History Tab ──────────────────────────────────────────────

function HistoryPanel({ entries }: { entries: TaskAuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--chalk3)', fontSize: 12 }}>
        No history recorded yet.
      </div>
    );
  }

  return (
    <div>
      {entries.map(entry => (
        <div key={entry.id} style={{
          display: 'flex', gap: 10, padding: '8px 0',
          borderBottom: '1px solid var(--wire)',
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', marginTop: 6, flexShrink: 0,
            background: entry.to_status ? STATE_COLORS[entry.to_status] : 'var(--chalk3)',
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--chalk2)' }}>
              {entry.actor && (
                <span style={{ fontWeight: 600, color: 'var(--chalk)' }}>{entry.actor.full_name} </span>
              )}
              {entry.from_status && entry.to_status && (
                <span>
                  moved{' '}
                  <span style={{ color: STATE_COLORS[entry.from_status] }}>{STATE_LABELS[entry.from_status]}</span>
                  {' → '}
                  <span style={{ color: STATE_COLORS[entry.to_status] }}>{STATE_LABELS[entry.to_status]}</span>
                </span>
              )}
              {entry.note && <span style={{ color: 'var(--chalk3)' }}> — {entry.note}</span>}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
              <span style={{
                fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 600,
                background: 'var(--bg3)', color: 'var(--chalk3)',
              }}>
                {entry.trigger_type}
              </span>
              <span style={{ fontSize: 10, color: 'var(--chalk3)' }}>
                {new Date(entry.created_at).toLocaleString('en-GB', {
                  day: '2-digit', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Modal ───────────────────────────────────────────────

interface Props {
  task:    Task | null;
  onClose: () => void;
}

export default function TaskDetailModal({ task, onClose }: Props) {
  const [activeTab,       setActiveTab]      = useState<Tab>('Overview');
  const [localStatus,     setLocalStatus]    = useState<TaskStatus>(task?.status ?? 'new');
  const [commentBody,     setCommentBody]    = useState('');
  const [commentType,     setCommentType]    = useState<CommentType>('NORMAL');
  const [replyingTo,      setReplyingTo]     = useState<string | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [showBlockModal,       setShowBlockModal]       = useState(false);
  const [showDoneModal,        setShowDoneModal]        = useState(false);
  // Workflow routing modals (Corrective Plan A + B)
  const [showPushBackModal,    setShowPushBackModal]    = useState(false);
  const [showForwardModal,     setShowForwardModal]     = useState(false);
  const [showForwardDeptModal, setShowForwardDeptModal] = useState(false);
  const [showEscalateModal,    setShowEscalateModal]    = useState(false);
  const [showReturnDeptModal,  setShowReturnDeptModal]  = useState(false);
  const [showAdminDeleteModal, setShowAdminDeleteModal] = useState(false);

  const qc                    = useQueryClient();
  const { addToast }          = useUIStore();
  const { user, roleLevel }   = useAuthStore();
  const perms                 = usePermissions();

  useEffect(() => {
    if (task?.status) setLocalStatus(task.status);
  }, [task?.status]);

  const { data: detail } = useQuery({
    queryKey: ['tasks', task?.id],
    queryFn:  () => tasksApi.get(task!.id),
    enabled:  !!task?.id,
    staleTime: 30 * 1000,
  });

  const comments:          TaskComment[]    = (detail as any)?.comments ?? [];
  const dependencies:      TaskDependency[] = (detail as any)?.dependencies ?? [];
  const unresolvedActions                   = hasUnresolvedActionComments(comments);

  const { data: auditEntries = [] } = useQuery({
    queryKey: ['tasks', task?.id, 'audit'],
    queryFn:  () => taskAuditApi.list(task!.id),
    enabled:  !!task?.id && activeTab === 'History',
    staleTime: 30 * 1000,
  });

  // H.1.2: Archive cross-references
  const { data: archiveRefs = [] } = useQuery({
    queryKey: ['tasks', task?.id, 'archive-refs'],
    queryFn:  () => tasksApi.getArchiveRefs(task!.id),
    enabled:  !!task?.id,
    staleTime: 60 * 1000,
  });

  // ── Transition mutation ──────────────────────────────────
  const doTransition = useMutation({
    mutationFn: (payload: TransitionRequest) => tasksApi.transition(task!.id, payload),
    onSuccess: async (_, payload) => {
      setLocalStatus(payload.to_status);
      setTransitionError(null);
      setShowBlockModal(false);
      setShowDoneModal(false);
      const fresh = await tasksApi.get(task!.id);
      qc.setQueryData(['tasks', task!.id], fresh);
      qc.invalidateQueries({ queryKey: ['tasks', 'board'] });
      qc.invalidateQueries({ queryKey: ['tasks', task!.id, 'audit'] });
      addToast({ type: 'success', title: `Task moved to ${STATE_LABELS[payload.to_status]}` });
    },
    onError: (err: any) => {
      setShowBlockModal(false);
      setShowDoneModal(false);
      const msg = err?.response?.data?.detail ?? 'Transition failed. Check validation rules.';
      setTransitionError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  // ── Comment mutations ────────────────────────────────────
  const postComment = useMutation({
    mutationFn: (payload: AddCommentRequest) => taskCommentsApi.add(task!.id, payload),
    onSuccess: async () => {
      const fresh = await tasksApi.get(task!.id);
      qc.setQueryData(['tasks', task!.id], fresh);
      qc.invalidateQueries({ queryKey: ['tasks', 'board'] });
      setCommentBody('');
      setReplyingTo(null);
    },
    onError: () => addToast({ type: 'error', title: 'Failed to post comment' }),
  });

  const postReply = useMutation({
    mutationFn: ({ parentId, payload }: { parentId: string; payload: AddCommentRequest }) =>
      taskCommentsApi.reply(task!.id, parentId, payload),
    onSuccess: async () => {
      const fresh = await tasksApi.get(task!.id);
      qc.setQueryData(['tasks', task!.id], fresh);
      setCommentBody('');
      setReplyingTo(null);
    },
    onError: () => addToast({ type: 'error', title: 'Failed to post reply' }),
  });

  const resolveComment = useMutation({
    mutationFn: (commentId: string) => taskCommentsApi.resolve(task!.id, commentId),
    onSuccess: async () => {
      const fresh = await tasksApi.get(task!.id);
      qc.setQueryData(['tasks', task!.id], fresh);
    },
  });

  // ── Workflow routing mutations (Corrective Plan A) ────────
  const doPushBack = useMutation({
    mutationFn: ({ reason, toUserId }: { reason: string; toUserId?: string }) =>
      tasksApi.pushBack(task!.id, reason, toUserId),
    onSuccess: async () => {
      const fresh = await tasksApi.get(task!.id);
      qc.setQueryData(['tasks', task!.id], fresh);
      qc.invalidateQueries({ queryKey: ['tasks', 'board'] });
      setShowPushBackModal(false);
      addToast({ type: 'success', title: 'Task returned. Reason logged and parties notified.' });
    },
    onError: (err: any) => {
      setShowPushBackModal(false);
      setTransitionError(err?.response?.data?.detail ?? 'Push back failed.');
    },
  });

  const doForward = useMutation({
    mutationFn: ({ toUserId, note }: { toUserId: string; note?: string }) =>
      tasksApi.forward(task!.id, toUserId, note),
    onSuccess: async () => {
      const fresh = await tasksApi.get(task!.id);
      qc.setQueryData(['tasks', task!.id], fresh);
      qc.invalidateQueries({ queryKey: ['tasks', 'board'] });
      setShowForwardModal(false);
      addToast({ type: 'success', title: 'Task forwarded. Assignment log updated.' });
    },
    onError: (err: any) => {
      setShowForwardModal(false);
      setTransitionError(err?.response?.data?.detail ?? 'Forward failed.');
    },
  });

  const doForwardDept = useMutation({
    mutationFn: ({ toDeptId, note }: { toDeptId: string; note?: string }) =>
      tasksApi.forwardDept(task!.id, toDeptId, note),
    onSuccess: async () => {
      const fresh = await tasksApi.get(task!.id);
      qc.setQueryData(['tasks', task!.id], fresh);
      qc.invalidateQueries({ queryKey: ['tasks', 'board'] });
      qc.invalidateQueries({ queryKey: ['dept-inbox'] });
      setShowForwardDeptModal(false);
      addToast({ type: 'success', title: 'Task routed to department. They have been notified.' });
    },
    onError: (err: any) => {
      setShowForwardDeptModal(false);
      setTransitionError(err?.response?.data?.detail ?? 'Department forward failed.');
    },
  });

  const doEscalate = useMutation({
    mutationFn: (note: string) => tasksApi.escalate(task!.id, note),
    onSuccess: async () => {
      const fresh = await tasksApi.get(task!.id);
      qc.setQueryData(['tasks', task!.id], fresh);
      setShowEscalateModal(false);
      addToast({ type: 'success', title: 'Escalated. Department manager has been notified.' });
    },
    onError: (err: any) => {
      setShowEscalateModal(false);
      setTransitionError(err?.response?.data?.detail ?? 'Escalation failed.');
    },
  });

  const doReturnDept = useMutation({
    mutationFn: (reason: string) => tasksApi.returnDept(task!.id, reason),
    onSuccess: async () => {
      const fresh = await tasksApi.get(task!.id);
      qc.setQueryData(['tasks', task!.id], fresh);
      qc.invalidateQueries({ queryKey: ['tasks', 'board'] });
      qc.invalidateQueries({ queryKey: ['dept-inbox'] });
      setShowReturnDeptModal(false);
      addToast({ type: 'success', title: 'Task returned to previous department.' });
    },
    onError: (err: any) => {
      setShowReturnDeptModal(false);
      setTransitionError(err?.response?.data?.detail ?? 'Return to department failed.');
    },
  });

  // ── Admin soft-delete mutation (Corrective Plan B) ────────
  const doSoftDelete = useMutation({
    mutationFn: (reason: string) => tasksApi.softDelete(task!.id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', 'board'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setShowAdminDeleteModal(false);
      addToast({
        type: 'success',
        title: `Task ${task?.ticket_number ?? ''} deleted. Department manager has been notified.`,
      });
      onClose();
    },
    onError: (err: any) => {
      setShowAdminDeleteModal(false);
      setTransitionError(err?.response?.data?.detail ?? 'Deletion failed.');
    },
  });

  // ── Reopen archived task mutation (E.2.3) ────────────────
  const doReopen = useMutation({
    mutationFn: () => tasksApi.reopen(task!.id),
    onSuccess: async () => {
      const fresh = await tasksApi.get(task!.id);
      qc.setQueryData(['tasks', task!.id], fresh);
      qc.invalidateQueries({ queryKey: ['tasks', 'board'] });
      addToast({ type: 'success', title: 'Task reopened and moved back to In Progress.' });
    },
    onError: (err: any) => {
      setTransitionError(err?.response?.data?.detail ?? 'Reopen failed.');
    },
  });

  // ── Move handler (routes blocked/done through modals) ────
  function handleMove(toStatus: TaskStatus) {
    if (!task || !user) return;

    const result = canMove({
      task:                 { ...task, dependencies },
      fromStatus:           localStatus,
      toStatus,
      user,
      hasUnresolvedActions: unresolvedActions,
    });

    if (!result.allowed) {
      setTransitionError(result.reason ?? 'This transition is not allowed.');
      return;
    }

    setTransitionError(null);

    if (toStatus === 'blocked') { setShowBlockModal(true); return; }
    if (toStatus === 'done')    { setShowDoneModal(true);  return; }

    doTransition.mutate({ to_status: toStatus });
  }

  function handleBlockConfirm(reason: string) {
    doTransition.mutate({
      to_status: 'blocked',
      comment:   { body: reason, type: 'NORMAL' },
    });
  }

  function handleDoneConfirm() {
    doTransition.mutate({ to_status: 'done' });
  }

  // ── Comment submit (pure work log — no workflow parsing) ──
  function handleCommentSubmit() {
    if (!commentBody.trim()) return;

    const payload: AddCommentRequest = {
      body:      commentBody.trim(),
      type:      commentType,
      mentions:  extractMentions(commentBody),
      parent_id: replyingTo ?? undefined,
    };

    if (replyingTo) {
      postReply.mutate({ parentId: replyingTo, payload });
    } else {
      postComment.mutate(payload);
    }
  }

  if (!task) return null;

  const isArchived = localStatus === 'archived';
  const isMutating = doTransition.isPending || postComment.isPending || postReply.isPending;

  return (
    <>
      {/* ── Backdrop + Modal ── */}
      <div
        onClick={e => e.target === e.currentTarget && onClose()}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(2,4,12,.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}
      >
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--wire2)',
          borderRadius: 16, padding: 22,
          width: '100%', maxWidth: 600,
          maxHeight: '92vh', overflowY: 'auto', scrollbarWidth: 'none',
          boxShadow: '0 24px 64px rgba(0,0,0,.7)',
        }}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ flex: 1, paddingRight: 12 }}>
              {task.ticket_number && (
                <div
                  title="Click to copy"
                  onClick={() => navigator.clipboard.writeText(task.ticket_number!)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
                    color: 'var(--brand)', letterSpacing: '0.06em',
                    padding: '2px 8px', borderRadius: 4,
                    background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.2)',
                    marginBottom: 6, cursor: 'copy',
                  }}
                >
                  {task.ticket_number}
                </div>
              )}
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--chalk)', lineHeight: 1.3, letterSpacing: '-.02em' }}>
                {task.title}
              </div>
              {task.department && (
                <div style={{ fontSize: 11, color: 'var(--chalk3)', marginTop: 3 }}>
                  {task.department.name}
                </div>
              )}
            </div>
            <button onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--chalk3)', cursor: 'pointer', fontSize: 20, flexShrink: 0 }}>
              ✕
            </button>
          </div>

          {/* ── Badges ── */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            <Badge
              label={task.priority}
              color={PRIORITY_COLOR[task.priority] || 'var(--chalk3)'}
              bg={`${PRIORITY_COLOR[task.priority] || 'var(--chalk3)'}22`}
            />
            <Badge
              label={STATE_LABELS[localStatus]}
              color={STATE_COLORS[localStatus]}
              bg={`${STATE_COLORS[localStatus]}22`}
            />
            {task.deadline && (
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--chalk2)',
                padding: '2px 8px', background: 'var(--bg3)', borderRadius: 5,
              }}>
                {new Date(task.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            )}
            {(task.tags ?? []).map(t => (
              <span key={t} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--bg4)', color: 'var(--chalk3)' }}>
                #{t}
              </span>
            ))}
            {dependencies.some(d => d.depends_on_task?.status !== 'done') && (
              <Badge label="Has Blockers" color="var(--rose)" bg="rgba(244,63,94,.12)" />
            )}
          </div>

          {/* ── Pipeline Stepper (visual only) ── */}
          {!isArchived ? (
            <PipelineStepper
              status={localStatus}
              isPending={doTransition.isPending}
            />
          ) : (
            <div style={{
              padding: '10px 14px', borderRadius: 8, marginBottom: 16,
              background: 'rgba(255,255,255,.04)', border: '1px solid var(--wire2)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 12 }}>📦</span>
              <span style={{ fontSize: 12, color: 'var(--chalk3)', flex: 1 }}>
                This task is archived. Clone it to start a new instance.
              </span>
              {user && (roleLevel >= 4 || (task as any)?.created_by === user.id) && (
                <button
                  onClick={() => doReopen.mutate()}
                  disabled={doReopen.isPending}
                  style={{
                    padding: '5px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                    cursor: doReopen.isPending ? 'not-allowed' : 'pointer',
                    border: 'none', fontFamily: 'var(--font)',
                    background: 'rgba(99,190,255,.12)', color: 'var(--brand)',
                    flexShrink: 0,
                  }}
                >
                  {doReopen.isPending ? '…' : '↺ Reopen Task'}
                </button>
              )}
            </div>
          )}

          {/* ── Action Buttons ── */}
          {user && !isArchived && (
            <ActionButtons
              status={localStatus}
              task={task}
              dependencies={dependencies}
              unresolvedActions={unresolvedActions}
              user={user}
              isPending={doTransition.isPending}
              canApprove={perms.canApproveTask}
              onMove={handleMove}
            />
          )}

          {/* ── Workflow Routing Actions (Corrective Plan A + B) ── */}
          {user && !isArchived && (() => {
            const td: any          = detail ?? task;
            const scope            = td?.task_scope;
            const isDeleted        = td?.is_deleted ?? false;
            const assigneeId       = td?.assignee_user_id ?? (task as any)?.assignee_user_id;
            const isAssignee       = !!user.id && assigneeId === user.id;
            const deptId           = td?.department_id ?? task?.department_id;

            const showPushBack     = !isDeleted && (isAssignee || roleLevel >= 4);
            const showFwdStaff     = !isDeleted && scope === 'internal' && (isAssignee || roleLevel >= 3);
            const showFwdDept      = !isDeleted && scope === 'external' && (isAssignee || roleLevel >= 3);
            const showEscalate     = !isDeleted && isAssignee;
            const showReturnDept   = !isDeleted && scope === 'external' && roleLevel >= 3;
            const showDelete       = !isDeleted && roleLevel >= 4;

            const anyVisible = showPushBack || showFwdStaff || showFwdDept || showEscalate || showReturnDept || showDelete;
            if (!anyVisible) return null;

            return (
              <div style={{ marginBottom: 14 }}>
                <div style={{
                  fontSize: 9, fontWeight: 700, color: 'var(--chalk3)',
                  textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8,
                }}>
                  Workflow Routing
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {showPushBack && (
                    <button
                      onClick={() => setShowPushBackModal(true)}
                      style={{
                        padding: '5px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'var(--font)', border: 'none',
                        background: 'rgba(244,63,94,.10)', color: 'var(--rose)',
                      }}>
                      ↩ Push Back
                    </button>
                  )}
                  {showFwdStaff && (
                    <button
                      onClick={() => setShowForwardModal(true)}
                      style={{
                        padding: '5px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'var(--font)', border: 'none',
                        background: 'rgba(99,190,255,.10)', color: 'var(--brand)',
                      }}>
                      → Forward to Staff
                    </button>
                  )}
                  {showFwdDept && (
                    <button
                      onClick={() => setShowForwardDeptModal(true)}
                      style={{
                        padding: '5px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'var(--font)', border: 'none',
                        background: 'rgba(245,158,11,.10)', color: 'var(--amber)',
                      }}>
                      🏢 Forward to Dept
                    </button>
                  )}
                  {showEscalate && (
                    <button
                      onClick={() => setShowEscalateModal(true)}
                      style={{
                        padding: '5px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'var(--font)', border: 'none',
                        background: 'rgba(245,158,11,.08)', color: 'var(--amber)',
                      }}>
                      ⚠ Escalate
                    </button>
                  )}
                  {showReturnDept && (
                    <button
                      onClick={() => setShowReturnDeptModal(true)}
                      style={{
                        padding: '5px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'var(--font)', border: 'none',
                        background: 'rgba(74,222,128,.08)', color: 'var(--green)',
                      }}>
                      ↖ Return to Dept
                    </button>
                  )}
                  {showDelete && (
                    <button
                      onClick={() => setShowAdminDeleteModal(true)}
                      style={{
                        padding: '5px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'var(--font)', border: 'none',
                        background: 'rgba(244,63,94,.08)', color: 'var(--rose)',
                        marginLeft: 'auto',
                      }}>
                      🗑 Delete Task
                    </button>
                  )}
                </div>
                {/* Invisible capture for closed-over values */}
                <span style={{ display: 'none' }}>{deptId}</span>
              </div>
            );
          })()}

          {/* ── Transition error ── */}
          {transitionError && (
            <div style={{
              padding: '8px 12px', borderRadius: 8, marginBottom: 12,
              background: 'rgba(244,63,94,.08)', border: '1px solid rgba(244,63,94,.3)',
              fontSize: 11, color: 'var(--rose)',
            }}>
              {transitionError}
            </div>
          )}

          {/* ── Tabs ── */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 14, borderBottom: '1px solid var(--wire)' }}>
            {TABS.map(tab => {
              const count =
                tab === 'Comments'      ? comments.filter(c => c.type !== 'SYSTEM').length
                : tab === 'Dependencies' ? dependencies.length
                : tab === 'History'     ? auditEntries.length
                : 0;
              return (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '7px 14px', borderRadius: '8px 8px 0 0',
                    border: 'none', cursor: 'pointer', fontFamily: 'var(--font)',
                    fontSize: 12, fontWeight: activeTab === tab ? 700 : 400,
                    background: activeTab === tab ? 'var(--bg3)' : 'none',
                    color: activeTab === tab ? 'var(--chalk)' : 'var(--chalk3)',
                    borderBottom: activeTab === tab ? '2px solid var(--brand)' : '2px solid transparent',
                  }}>
                  {tab}{count > 0 ? ` (${count})` : ''}
                </button>
              );
            })}
          </div>

          {/* ── Tab: Overview ── */}
          {activeTab === 'Overview' && (
            <div>
              {task.description && (
                <p style={{
                  fontSize: 12, color: 'var(--chalk2)', lineHeight: 1.6,
                  marginBottom: 14, padding: '12px 14px',
                  background: 'var(--bg3)', borderRadius: 8,
                }}>
                  {task.description}
                </p>
              )}

              {(task.assignee || task.responsible_user) && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Assignee',    person: task.assignee },
                    { label: 'Responsible', person: task.responsible_user },
                  ].filter(r => r.person).map(({ label, person }) => person && (
                    <div key={label} style={{
                      display: 'flex', alignItems: 'center', gap: 8, flex: 1,
                      padding: '10px 14px', background: 'var(--bg3)', borderRadius: 8, minWidth: 180,
                    }}>
                      <Avatar name={person.full_name} />
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--chalk3)', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--chalk)' }}>{person.full_name}</div>
                        {person.job_title && (
                          <div style={{ fontSize: 10, color: 'var(--chalk3)' }}>{person.job_title}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {dependencies.length > 0 && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, background: 'var(--bg3)',
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 14,
                }}
                  onClick={() => setActiveTab('Dependencies')}
                >
                  <span style={{ fontSize: 12 }}>🔗</span>
                  <span style={{ fontSize: 12, color: 'var(--chalk2)' }}>
                    {dependencies.length} dependenc{dependencies.length === 1 ? 'y' : 'ies'} —{' '}
                    {dependencies.filter(d => d.depends_on_task?.status === 'done').length} / {dependencies.length} complete
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--brand)', marginLeft: 'auto' }}>View →</span>
                </div>
              )}

              {/* H.1.2: Archive cross-references */}
              {archiveRefs.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, color: 'var(--chalk3)',
                    textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8,
                  }}>
                    Archive References
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(archiveRefs as any[]).map((ref: any) => (
                      <div key={ref.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 12px', borderRadius: 8, background: 'var(--bg3)',
                      }}>
                        <span style={{ fontSize: 10 }}>{ref.type === 'task' ? '📋' : '📁'}</span>
                        {ref.ticket_number && (
                          <span style={{
                            fontSize: 9, fontFamily: 'var(--mono)',
                            color: 'var(--chalk3)', background: 'rgba(255,255,255,.06)',
                            padding: '1px 5px', borderRadius: 3,
                          }}>
                            {ref.ticket_number}
                          </span>
                        )}
                        <span style={{ fontSize: 12, color: 'var(--chalk2)', flex: 1 }}>{ref.title}</span>
                        {ref.pipeline_stage && (
                          <span style={{ fontSize: 10, color: 'var(--chalk3)' }}>{ref.pipeline_stage}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unified activity feed */}
              <ErrorBoundary>
                <ActivityTimeline
                  entityType="task"
                  entityId={task.id}
                  canComment={true}
                  showFilter={true}
                  maxHeight={320}
                />
              </ErrorBoundary>
            </div>
          )}

          {/* ── Tab: Comments (structured work log + replies) ── */}
          {activeTab === 'Comments' && (
            <div>
              <div style={{ marginBottom: 12 }}>
                {comments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--chalk3)', fontSize: 12 }}>
                    No comments yet. Start the conversation.
                  </div>
                ) : (
                  comments.map(c => (
                    <CommentBubble
                      key={c.id}
                      comment={c}
                      onReply={id => { setReplyingTo(id); setCommentBody(''); }}
                      onResolve={id => resolveComment.mutate(id)}
                      canResolve={perms.canResolveAction}
                    />
                  ))
                )}
              </div>

              {replyingTo && (
                <div style={{
                  padding: '5px 10px', borderRadius: 6, marginBottom: 6,
                  background: 'rgba(99,190,255,.08)', border: '1px solid rgba(99,190,255,.2)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 11, color: 'var(--brand)' }}>↩ Replying to a comment</span>
                  <button onClick={() => setReplyingTo(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--chalk3)', fontSize: 12 }}>✕</button>
                </div>
              )}

              {/* Comment type: NORMAL or ACTION only */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                {(['NORMAL', 'ACTION'] as CommentType[]).map(t => {
                  const m = COMMENT_TYPE_META[t];
                  return (
                    <button key={t} onClick={() => setCommentType(t)}
                      style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'var(--font)',
                        background: commentType === t ? `${m.color}22` : 'var(--bg3)',
                        color:      commentType === t ? m.color : 'var(--chalk3)',
                        border:     commentType === t ? `1px solid ${m.color}55` : '1px solid var(--wire2)',
                      }}>
                      {m.icon} {m.label}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <textarea
                  value={commentBody}
                  onChange={e => setCommentBody(e.target.value)}
                  placeholder={
                    commentType === 'ACTION'
                      ? 'Flag something that needs attention… @mention a colleague.'
                      : 'Work log entry… @mention a colleague.'
                  }
                  rows={3}
                  style={{
                    flex: 1, background: 'var(--bg3)', border: '1px solid var(--wire2)',
                    borderRadius: 8, padding: '8px 10px', color: 'var(--chalk)',
                    fontFamily: 'var(--font)', fontSize: 12, outline: 'none', resize: 'none',
                  }}
                />
                <button
                  onClick={handleCommentSubmit}
                  disabled={!commentBody.trim() || isMutating}
                  style={{
                    padding: '8px 14px', borderRadius: 8, border: 'none', alignSelf: 'flex-end',
                    background: 'var(--brand)', color: '#050810', fontSize: 11, fontWeight: 700,
                    cursor: !commentBody.trim() || isMutating ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font)',
                    opacity: !commentBody.trim() || isMutating ? 0.5 : 1,
                  }}>
                  Post
                </button>
              </div>
            </div>
          )}

          {/* ── Tab: Dependencies ── */}
          {activeTab === 'Dependencies' && (
            <DependencyPanel dependencies={dependencies} />
          )}

          {/* ── Tab: History ── */}
          {activeTab === 'History' && (
            <HistoryPanel entries={auditEntries as TaskAuditEntry[]} />
          )}

          {/* ── Footer ── */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 8,
            marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--wire)',
          }}>
            {isArchived && (
              <button
                onClick={() => tasksApi.clone(task.id).then(() => {
                  addToast({ type: 'success', title: 'Task cloned' });
                  qc.invalidateQueries({ queryKey: ['tasks', 'board'] });
                  onClose();
                })}
                style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'var(--font)',
                  background: 'rgba(99,190,255,.1)', color: 'var(--brand)',
                  border: '1px solid rgba(99,190,255,.3)',
                }}>
                Clone Task
              </button>
            )}
            <button onClick={onClose}
              style={{
                padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font)',
                background: 'rgba(255,255,255,.05)', color: 'var(--chalk2)',
                border: '1px solid var(--wire2)',
              }}>
              Close
            </button>
          </div>

        </div>
      </div>

      {/* ── Block Reason Modal ── */}
      {showBlockModal && (
        <BlockReasonModal
          onConfirm={handleBlockConfirm}
          onClose={() => setShowBlockModal(false)}
          isPending={doTransition.isPending}
        />
      )}

      {/* ── Mark Done Modal ── */}
      {showDoneModal && (
        <MarkDoneModal
          taskTitle={task.title}
          onConfirm={handleDoneConfirm}
          onClose={() => setShowDoneModal(false)}
          isPending={doTransition.isPending}
        />
      )}

      {/* ── Workflow Routing Modals (Corrective Plan A + B) ── */}
      {showPushBackModal && (
        <PushBackModal
          taskId={task.id}
          taskTitle={task.title}
          onConfirm={(reason, toUserId) => doPushBack.mutate({ reason, toUserId })}
          onClose={() => setShowPushBackModal(false)}
          isPending={doPushBack.isPending}
        />
      )}

      {showForwardModal && (
        <ForwardModal
          taskTitle={task.title}
          currentUserId={user?.id ?? ''}
          onConfirm={(toUserId, note) => doForward.mutate({ toUserId, note })}
          onClose={() => setShowForwardModal(false)}
          isPending={doForward.isPending}
        />
      )}

      {showForwardDeptModal && (
        <ForwardDeptModal
          taskTitle={task.title}
          currentDeptId={(detail as any)?.department_id ?? (task as any)?.department_id ?? ''}
          onConfirm={(toDeptId, note) => doForwardDept.mutate({ toDeptId, note })}
          onClose={() => setShowForwardDeptModal(false)}
          isPending={doForwardDept.isPending}
        />
      )}

      {showEscalateModal && (
        <EscalateModal
          taskTitle={task.title}
          onConfirm={note => doEscalate.mutate(note)}
          onClose={() => setShowEscalateModal(false)}
          isPending={doEscalate.isPending}
        />
      )}

      {showReturnDeptModal && (
        <ReturnDeptModal
          taskId={task.id}
          taskTitle={task.title}
          onConfirm={reason => doReturnDept.mutate(reason)}
          onClose={() => setShowReturnDeptModal(false)}
          isPending={doReturnDept.isPending}
        />
      )}

      {showAdminDeleteModal && (
        <AdminDeleteModal
          taskId={task.id}
          taskTitle={task.title}
          ticketNumber={task.ticket_number ?? null}
          deptName={(detail as any)?.department?.name ?? task.department?.name ?? null}
          onConfirm={reason => doSoftDelete.mutate(reason)}
          onClose={() => setShowAdminDeleteModal(false)}
          isPending={doSoftDelete.isPending}
        />
      )}
    </>
  );
}
