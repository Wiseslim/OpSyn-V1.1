// ============================================================
// OPSYN OUTAGE DETAIL PAGE — /outage/:id  (Stage 7 token update)
// OUT reference · SLA countdown · Timeline tabs
// ============================================================

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { outageApi } from '../../api/index';

// ── Shared primitives ─────────────────────────────────────────
const card = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: 'white', border: '1px solid var(--color-border)',
  borderRadius: 12, padding: 16, position: 'relative', overflow: 'hidden', ...extra,
});
const badge = (color: string, bg: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 3,
  padding: '2px 7px', borderRadius: 5, fontSize: 11, fontWeight: 600, color, background: bg,
});

function Btn({ variant = 'ghost', onClick, children, style, disabled }: any) {
  const bg  = variant === 'brand' ? 'var(--color-teal)'
            : variant === 'rose'  ? 'rgba(220,38,38,.1)'
            : variant === 'jade'  ? 'rgba(22,163,74,.1)'
            : variant === 'amber' ? 'rgba(245,158,11,.1)'
            : 'rgba(100,116,139,.06)';
  const col = variant === 'brand' ? 'white'
            : variant === 'rose'  ? 'var(--color-red)'
            : variant === 'jade'  ? 'var(--color-green)'
            : variant === 'amber' ? 'var(--color-amber)'
            : 'var(--color-text-primary)';
  return (
    <button disabled={disabled} onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '6px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
      transition: 'all .15s', whiteSpace: 'nowrap', opacity: disabled ? 0.5 : 1,
      background: bg, color: col, border: variant === 'ghost' ? '1px solid var(--color-border)' : 'none', ...style,
    }}>{children}</button>
  );
}

// ── SLA Countdown hook ────────────────────────────────────────
function useSlaCountdown(deadline?: string) {
  const [remaining, setRemaining] = useState<{ mins: number; pct: number; expired: boolean } | null>(null);

  useEffect(() => {
    if (!deadline) return;
    const update = () => {
      const now      = Date.now();
      const end      = new Date(deadline).getTime();
      const diffMs   = end - now;
      const mins     = Math.max(0, Math.floor(diffMs / 60000));
      const expired  = diffMs <= 0;
      setRemaining({ mins, pct: 0, expired });
    };
    update();
    const t = setInterval(update, 30000);
    return () => clearInterval(t);
  }, [deadline]);

  return remaining;
}

// ── Severity / status colours ─────────────────────────────────
const SEV_COLOR: Record<string, string> = {
  critical: 'var(--color-red)', high: 'var(--color-amber)', warning: 'var(--color-amber)', low: 'var(--color-teal)',
};
const STATUS_COLOR: Record<string, string> = {
  active: 'var(--color-red)', monitoring: 'var(--color-amber)', resolved: 'var(--color-green)',
};
const EVENT_ICON: Record<string, string> = {
  comment: '💬', state_change: '🔄', stage_event: '📌', system: '⚙',
};

export default function OutageDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const [tab, setTab] = useState<'timeline' | 'customers' | 'task'>('timeline');
  const [notifyDone, setNotifyDone] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['outage', id],
    queryFn:  () => outageApi.get(id!),
    enabled:  !!id,
    refetchInterval: 30000,
  });

  const resolve = useMutation({
    mutationFn: () => outageApi.resolve(id!),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['outage', id] }); qc.invalidateQueries({ queryKey: ['outages'] }); },
  });

  const notify = useMutation({
    mutationFn: () => outageApi.notifyCustomers(id!),
    onSuccess:  () => setNotifyDone(true),
  });

  const inc = data as any;
  const sla = useSlaCountdown(inc?.sla_deadline);

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)', fontSize: 13 }}>
      Loading incident…
    </div>
  );
  if (isError || !inc) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-red)', fontSize: 13 }}>
      Incident not found.
    </div>
  );

  const sevColor    = SEV_COLOR[inc.severity]    ?? 'var(--color-text-muted)';
  const statusColor = STATUS_COLOR[inc.status]   ?? 'var(--color-text-muted)';
  const isResolved  = inc.status === 'resolved';
  const slaBreached = inc.breached_sla;

  const slaColor = slaBreached ? 'var(--color-red)' : (sla && sla.mins < 30) ? 'var(--color-red)' : (sla && sla.mins < 60) ? 'var(--color-amber)' : 'var(--color-green)';

  const tabs = [
    { key: 'timeline'  as const, label: 'Timeline' },
    { key: 'customers' as const, label: `Affected Customers (${(inc.affected_customer_ids ?? []).length})` },
    { key: 'task'      as const, label: 'Linked Task' },
  ];

  return (
    <div style={{ overflow: 'auto', flex: 1, background: 'var(--color-surface)' }}>
      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'white',
        borderBottom: '1px solid var(--color-border)', padding: '8px 20px',
      }}>
        <button onClick={() => navigate('/outage')} style={{
          background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer',
          fontSize: 12, fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 5,
        }}>← Outage Monitor</button>

        <div style={{ display: 'flex', gap: 8 }}>
          {!isResolved && (
            <>
              <Btn variant="jade"  onClick={() => resolve.mutate()} disabled={resolve.isPending}>
                {resolve.isPending ? 'Resolving…' : 'Resolve Incident'}
              </Btn>
              <Btn variant="amber" onClick={() => notify.mutate()}  disabled={notify.isPending || notifyDone}>
                {notifyDone ? '✓ Notified' : notify.isPending ? 'Sending…' : 'Notify Customers'}
              </Btn>
            </>
          )}
        </div>
      </div>

      <div style={{ padding: 20 }}>
        {/* ── Header row ── */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          {/* Incident card */}
          <div style={{ ...card(), flex: 3, minWidth: 300 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--color-teal)' }}>{inc.reference}</span>
              <span style={badge(sevColor, `${sevColor}1a`)}>{inc.severity}</span>
              <span style={badge(statusColor, `${statusColor}1a`)}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                {inc.status}
              </span>
              {inc.source && inc.source !== 'manual' && (
                <span style={badge('var(--color-indigo)', 'rgba(79,70,229,.1)')}>{inc.source}</span>
              )}
            </div>
            <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--color-text-primary)', marginBottom: 6, letterSpacing: '-.02em' }}>{inc.title}</div>
            {inc.description && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{inc.description}</div>}
          </div>

          {/* Metadata sidebar */}
          <div style={{ ...card({ padding: 0 }), flex: 1, minWidth: 200 }}>
            {[
              ['OLT Reference', inc.olt_reference ?? '—'],
              ['Affected Subscribers', String(inc.affected_subscribers ?? 0)],
              ['Source', inc.source ?? 'manual'],
              ['Logged', new Date(inc.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })],
              ...(inc.resolved_at ? [['Resolved', new Date(inc.resolved_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })]] : []),
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{k}</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── SLA bar ── */}
        {inc.sla_deadline && (
          <div style={{ ...card({ padding: '12px 16px', marginBottom: 16 }) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
                SLA Status
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {slaBreached && <span style={badge('var(--color-red)', 'rgba(220,38,38,.1)')}>BREACHED</span>}
                {sla && !slaBreached && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: slaColor, fontFamily: 'var(--font-mono)' }}>
                    {sla.expired ? 'Deadline passed' : `${sla.mins}m remaining`}
                  </span>
                )}
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  Deadline: {new Date(inc.sla_deadline).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
            {!isResolved && (
              <div style={{ height: 6, background: 'var(--color-surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: (() => {
                    if (slaBreached) return '100%';
                    if (!sla) return '0%';
                    const created = new Date(inc.created_at).getTime();
                    const dead    = new Date(inc.sla_deadline).getTime();
                    const now     = Date.now();
                    const pct     = Math.min(100, ((now - created) / (dead - created)) * 100);
                    return `${pct.toFixed(1)}%`;
                  })(),
                  background: slaColor,
                  borderRadius: 3,
                  transition: 'width .5s',
                }} />
              </div>
            )}
          </div>
        )}

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--color-border)', marginBottom: 16 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              background: 'none', border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--color-teal)' : '2px solid transparent',
              color: tab === t.key ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              fontSize: 12, fontWeight: 600,
              padding: '8px 16px', cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all .15s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── Timeline tab ── */}
        {tab === 'timeline' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(!inc.timeline || inc.timeline.length === 0) ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)', fontSize: 12 }}>No timeline events yet.</div>
            ) : [...inc.timeline].reverse().map((e: any) => (
              <div key={e.id} style={{ ...card({ padding: '10px 14px' }), display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{EVENT_ICON[e.event_type] ?? '📋'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-primary)', lineHeight: 1.5 }}>{e.body}</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4 }}>
                    {e.created_at ? new Date(e.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                    {e.event_type === 'system' && e.meta?.sla_event && (
                      <span style={{ marginLeft: 8, ...badge('var(--color-amber)', 'rgba(245,158,11,.1)'), padding: '1px 5px' }}>
                        SLA {e.meta.sla_event}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Affected Customers tab ── */}
        {tab === 'customers' && (
          <div>
            {(inc.affected_customer_ids ?? []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)', fontSize: 12 }}>
                No customer IDs recorded for this incident.
              </div>
            ) : (
              <div style={{ ...card({ padding: 0 }), overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={{ textAlign: 'left', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-text-muted)', padding: '9px 14px', borderBottom: '1px solid var(--color-border)' }}>#</th>
                    <th style={{ textAlign: 'left', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-text-muted)', padding: '9px 14px', borderBottom: '1px solid var(--color-border)' }}>Customer ID</th>
                  </tr></thead>
                  <tbody>
                    {(inc.affected_customer_ids ?? []).map((cid: string, i: number) => (
                      <tr key={cid}>
                        <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--color-border)', fontSize: 11, color: 'var(--color-text-muted)' }}>{i + 1}</td>
                        <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--color-border)', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-teal)' }}>{cid}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Linked Task tab ── */}
        {tab === 'task' && (
          <div>
            {!inc.linked_task_id ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)', fontSize: 12 }}>
                No task linked to this incident.
              </div>
            ) : (
              <div style={{ ...card() }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>Linked Task ID</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-teal)', fontWeight: 600 }}>
                  {inc.linked_task_id}
                </div>
                <div style={{ marginTop: 12 }}>
                  <Btn variant="ghost" onClick={() => navigate(`/tasks?highlight=${inc.linked_task_id}`)}>
                    View Task →
                  </Btn>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
