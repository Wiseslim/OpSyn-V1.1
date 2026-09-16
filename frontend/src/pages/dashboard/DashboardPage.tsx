// ============================================================
// OPSYN — DashboardPage  (Stage 4 redesign)
// Light theme · design tokens · white cards with colored top borders
// ============================================================

import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, outageApi, onboardingApi } from '../../api/index';
import { tasksApi } from '../../api/tasks.api';
import { useAuthStore } from '../../store/auth.store';
import { Button, Badge } from '../../components/ui';

const toArr = (d: any): any[] => Array.isArray(d) ? d : (d?.items ?? []);

function KpiTile({ label, value, color, delta, deltaGood }: {
  label: string; value: string | number; color: string;
  delta?: string; deltaGood?: boolean;
}) {
  return (
    <div style={{
      background:   'white',
      border:       '1px solid var(--color-border)',
      borderRadius: 'var(--radius-card)',
      padding:      '16px 18px',
      borderTop:    `3px solid ${color}`,
    }}>
      <div style={{
        fontFamily:    'var(--font-display)',
        fontSize:      11,
        fontWeight:    600,
        color:         'var(--color-text-muted)',
        letterSpacing: '.08em',
        textTransform: 'uppercase',
        marginBottom:  8,
      }}>{label}</div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize:   28,
        fontWeight: 700,
        color,
        lineHeight: 1,
      }}>{value}</div>
      {delta && (
        <div style={{
          fontSize:   11,
          color:      deltaGood ? 'var(--color-green)' : 'var(--color-red)',
          marginTop:  4,
        }}>
          {deltaGood ? '↑' : '↓'} {delta}
        </div>
      )}
    </div>
  );
}

function Pbar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ background: 'var(--color-surface-2)', borderRadius: 3, height: 4, overflow: 'hidden' }}>
      <div style={{
        width:      `${Math.max(0, Math.min(100, pct))}%`,
        height:     '100%',
        background: color,
        borderRadius: 3,
        transition: 'width .8s cubic-bezier(.34,1.56,.64,1)',
      }} />
    </div>
  );
}

function Card({ children, style, onClick }: { children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void }) {
  return (
    <div
      style={{
        background:   'white',
        border:       '1px solid var(--color-border)',
        borderRadius: 'var(--radius-card)',
        padding:      16,
        ...style,
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

function CardHeader({ title, sub, action, onAction }: { title: string; sub?: string; action?: string; onAction?: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--color-text-primary)' }}>
          {title}
        </div>
        {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
      {action && onAction && (
        <Button variant="ghost" size="xs" onClick={onAction}>{action}</Button>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const navigate    = useNavigate();
  const user        = useAuthStore((s: any) => s.user);
  const firstName   = user?.username?.split('_')[0] ?? 'there';

  const { data: kpi }        = useQuery({ queryKey: ['dashboard', 'summary'], queryFn: () => dashboardApi.getSummary(), refetchInterval: 30000 });
  const { data: board }      = useQuery({ queryKey: ['tasks', 'board'],        queryFn: () => tasksApi.getBoard(),       refetchInterval: 60000 });
  const { data: outages }    = useQuery({ queryKey: ['outages', 'live'],        queryFn: () => outageApi.getLive(),       refetchInterval: 30000 });
  const { data: onboarding } = useQuery({ queryKey: ['onboarding', 'pending'],  queryFn: () => onboardingApi.list({ status: 'pending' }) });

  const k              = kpi as any;
  const totalStaff     = k?.staff?.total ?? 0;
  const liveOutages    = k?.outages?.live ?? toArr(outages).length;
  const openTasks      = k?.tasks?.open ?? 0;
  const overdueTasks   = k?.tasks?.overdue ?? 0;
  const uptimePct      = k?.infrastructure?.network_uptime_pct ?? 100;
  const totalNodes     = k?.infrastructure?.total_nodes ?? 0;
  const activeNodes    = k?.infrastructure?.active_nodes ?? 0;
  const unread         = k?.notifications?.unread ?? 0;
  const activeProjects = k?.projects?.active ?? 0;

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={{ overflow: 'auto', flex: 1, background: 'var(--color-surface)' }}>
      <div style={{ padding: '20px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{
            fontFamily:    'var(--font-display)',
            fontSize:      22,
            fontWeight:    800,
            color:         'var(--color-text-primary)',
            letterSpacing: '-.03em',
            margin:        0,
          }}>
            {greeting}, {firstName}
          </h1>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0 }}>
            Opsyn Command Center · Live 30s refresh
          </p>
        </div>

        {/* KPI grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
          <KpiTile label="Active Personnel" value={totalStaff}       color="var(--color-teal)" />
          <KpiTile
            label="Open Tasks"     value={openTasks}       color="var(--color-indigo)"
            delta={overdueTasks > 0 ? `${overdueTasks} overdue` : undefined}
            deltaGood={false}
          />
          <KpiTile
            label="Active Outages" value={liveOutages}     color={liveOutages > 0 ? 'var(--color-red)' : 'var(--color-green)'}
            delta={liveOutages > 0 ? 'needs attention' : 'all clear'}
            deltaGood={liveOutages === 0}
          />
          <KpiTile
            label="Network Uptime" value={`${uptimePct}%`} color={uptimePct >= 99 ? 'var(--color-green)' : 'var(--color-amber)'}
            delta={totalNodes > 0 ? `${activeNodes}/${totalNodes} nodes` : 'no nodes'}
            deltaGood={uptimePct >= 99}
          />
        </div>

        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>

          {/* Left: main content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Task Pipeline */}
            <Card>
              <CardHeader title="Task Pipeline" sub="Real-time operational task status" action="Open Board →" onAction={() => navigate('/tasks')} />

              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                {[
                  { n: overdueTasks,                              label: 'Overdue',   color: 'var(--color-red)' },
                  { n: (board as any)?.today?.length ?? 0,         label: 'Due Today',  color: 'var(--color-amber)' },
                  { n: (board as any)?.this_week?.length ?? 0,     label: 'This Week',  color: 'var(--color-teal)' },
                  { n: (board as any)?.backlog?.length ?? 0,       label: 'Backlog',    color: 'var(--color-text-muted)' },
                ].map(item => (
                  <div key={item.label} style={{
                    flex:        1,
                    padding:     '10px 12px',
                    background:  'var(--color-surface-2)',
                    borderRadius: 8,
                    borderLeft:  `3px solid ${item.color}`,
                  }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: item.color }}>
                      {item.n}
                    </div>
                    <div style={{
                      fontSize:      9,
                      color:         'var(--color-text-muted)',
                      marginTop:     2,
                      textTransform: 'uppercase',
                      letterSpacing: '.08em',
                    }}>
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>

              {[
                ...((board as any)?.overdue ?? []),
                ...((board as any)?.today ?? []),
                ...((board as any)?.this_week ?? []),
              ].slice(0, 3).map((t: any, i: number) => (
                <div key={t.id ?? i} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, marginBottom: 5 }}>
                    <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{t.title}</span>
                    <Badge
                      variant={t.priority === 'critical' ? 'critical' : t.priority === 'high' ? 'high' : 'info'}
                      size="sm"
                    >
                      {t.priority}
                    </Badge>
                  </div>
                  <Pbar
                    color="var(--color-teal)"
                    pct={t.status === 'done' ? 100 : t.status === 'in_review' ? 80 : t.status === 'in_progress' ? 50 : 10}
                  />
                </div>
              ))}
              {openTasks === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12, padding: 16 }}>
                  No open tasks. Create your first task from the Task Board.
                </div>
              )}
            </Card>

            {/* Active Projects */}
            {activeProjects > 0 && (
              <Card style={{ cursor: 'pointer' }} onClick={() => navigate('/projects')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--color-text-primary)' }}>
                      Active Projects
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>Currently in pipeline</div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, color: 'var(--color-teal)' }}>
                    {activeProjects}
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Right: sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Live Outages */}
            <Card>
              <CardHeader title="Live Outages" action="Monitor →" onAction={() => navigate('/outage')} />
              {toArr(outages).length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--color-green)', textAlign: 'center', padding: 12 }}>
                  ✓ No active outages
                </div>
              ) : toArr(outages).slice(0, 2).map((o: any) => (
                <div key={o.id ?? o.reference} style={{
                  padding:      '10px 12px',
                  marginBottom: 8,
                  background:   'var(--color-surface-2)',
                  border:       '1px solid var(--color-border)',
                  borderRadius: 8,
                  borderLeft:   `3px solid ${o.severity === 'critical' ? 'var(--color-red)' : 'var(--color-amber)'}`,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 3 }}>
                    {o.title}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 6 }}>{o.reference}</div>
                  <Badge variant={o.severity === 'critical' ? 'critical' : o.severity === 'high' ? 'high' : 'warning'} size="sm">
                    {o.severity}
                  </Badge>
                </div>
              ))}
            </Card>

            {/* Pending Onboarding */}
            <Card>
              <CardHeader title="Pending Onboarding" action="Review →" onAction={() => navigate('/onboarding')} />
              {toArr(onboarding).slice(0, 3).length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center', padding: 8 }}>
                  No pending requests
                </div>
              ) : toArr(onboarding).slice(0, 3).map((r: any) => (
                <div key={r.id} style={{
                  display:       'flex',
                  justifyContent:'space-between',
                  alignItems:    'center',
                  padding:       '9px 0',
                  borderBottom:  '1px solid var(--color-border)',
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-primary)', fontWeight: 500 }}>
                      {r.proposed_first_name} {r.proposed_last_name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{r.approval_status}</div>
                  </div>
                  <Badge variant={r.approval_status === 'pending' ? 'warning' : 'critical'} size="sm">
                    {r.approval_status}
                  </Badge>
                </div>
              ))}
            </Card>

            {/* Unread notifications */}
            {unread > 0 && (
              <Card style={{ cursor: 'pointer', border: '1px solid var(--color-teal)' }} onClick={() => navigate('/notifications')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: 'var(--color-teal)',
                    boxShadow:  '0 0 8px rgba(0,194,168,.5)',
                    flexShrink: 0,
                  }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-teal)' }}>
                      {unread} unread notification{unread > 1 ? 's' : ''}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Click to view →</div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
