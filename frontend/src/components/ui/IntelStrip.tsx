// ============================================================
// OPSYN INTEL STRIP — S2.4.5
// 5-chip KPI bar: active_outages · tasks_overdue · staff_on_call
//                 avg_mttr · pending_onboarding
// 30s polling · chip → navigate to relevant page
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { reportsApi } from '../../api/index';

function formatMTTR(mins: number | null | undefined): string {
  if (mins == null) return '—';
  const t = Math.round(Number(mins));
  const h = Math.floor(t / 60);
  const m = t % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface Chip {
  key: string;
  label: string;
  value: string;
  color: string;
  path: string;
  alertWhen?: (v: number | null) => boolean;
}

export default function IntelStrip() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['intel-strip'],
    queryFn: () => reportsApi.getIntelStrip(),
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  if (isLoading || !data) return null;

  const d = data as any;

  const chips: Chip[] = [
    {
      key:        'active_outages',
      label:      'Active Outages',
      value:      String(d.active_outages ?? 0),
      color:      d.active_outages > 0 ? 'var(--rose)' : 'var(--green)',
      path:       '/outage',
      alertWhen:  v => (v ?? 0) > 0,
    },
    {
      key:        'tasks_overdue',
      label:      'Tasks Overdue',
      value:      String(d.tasks_overdue ?? 0),
      color:      d.tasks_overdue > 0 ? 'var(--amber)' : 'var(--chalk3)',
      path:       '/tasks',
      alertWhen:  v => (v ?? 0) > 0,
    },
    {
      key:        'staff_on_call',
      label:      'Staff Active',
      value:      String(d.staff_on_call ?? 0),
      color:      'var(--cyan)',
      path:       '/staff',
    },
    {
      key:        'avg_mttr',
      label:      'Avg MTTR',
      value:      formatMTTR(d.avg_mttr_mins),
      color:      d.avg_mttr_mins != null && d.avg_mttr_mins > 120 ? 'var(--rose)'
                : d.avg_mttr_mins != null && d.avg_mttr_mins > 60  ? 'var(--amber)'
                : 'var(--green)',
      path:       '/reports',
    },
    {
      key:        'pending_onboarding',
      label:      'Pending Onboarding',
      value:      String(d.pending_onboarding ?? 0),
      color:      d.pending_onboarding > 0 ? 'var(--violet)' : 'var(--chalk3)',
      path:       '/onboarding',
      alertWhen:  v => (v ?? 0) > 0,
    },
  ];

  return (
    <div style={{
      height: 32,
      borderBottom: '1px solid var(--wire)',
      background: 'linear-gradient(90deg,var(--bg2),rgba(6,182,212,.025),var(--bg2))',
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      padding: '0 16px',
      flexShrink: 0,
      overflowX: 'auto',
      scrollbarWidth: 'none',
    }}>
      {chips.map((chip, i) => {
        const isAlert = chip.alertWhen?.(Number(chip.value.replace('m','')) || null) ?? false;
        return (
          <div key={chip.key}>
            <button
              onClick={() => navigate(chip.path)}
              title={`Navigate to ${chip.label}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 10px',
                borderRadius: 5,
                border: isAlert ? `1px solid ${chip.color}40` : '1px solid transparent',
                background: isAlert ? `${chip.color}0d` : 'transparent',
                cursor: 'pointer',
                fontFamily: 'var(--font)',
                transition: 'all .15s',
              }}
            >
              {isAlert && (
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: chip.color,
                  display: 'block',
                  animation: 'pulse 1.5s infinite',
                  flexShrink: 0,
                }} />
              )}
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--chalk3)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                {chip.label}
              </span>
              <span style={{ fontSize: 11, fontWeight: 800, color: chip.color, fontFamily: 'var(--mono)' }}>
                {chip.value}
              </span>
            </button>
            {i < chips.length - 1 && (
              <span style={{ width: 1, height: 14, background: 'var(--wire2)', display: 'inline-block', verticalAlign: 'middle', margin: '0 2px' }} />
            )}
          </div>
        );
      })}

      <div style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--chalk4)', fontFamily: 'var(--mono)', flexShrink: 0 }}>
        30s
      </div>
    </div>
  );
}
