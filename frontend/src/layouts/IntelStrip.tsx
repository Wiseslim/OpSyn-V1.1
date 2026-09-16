// ============================================================
// OPSYN INTEL STRIP — src/layouts/IntelStrip.tsx  (Stage 2)
// grid-area: intelstrip  |  height: var(--intelstrip-height) = 40px
// Always visible on all authenticated pages.
// 30-second polling from GET /reports/intel-strip.
// 5 live KPI chips + last-updated timestamp.
// ============================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { reportsApi } from '../api/index';
import { usePermissions } from '../hooks/usePermissions';

interface IntelData {
  active_outages:     number;
  tasks_overdue:      number;
  staff_on_call:      number;
  avg_mttr_mins:      number | null;
  pending_onboarding: number;
}

function formatMTTR(mins: number | null): string {
  if (mins == null) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function nowHHMM(): string {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// ── Chip component ─────────────────────────────────────────────
function Chip({
  label, value, pulse, outline, onClick,
}: {
  label:    string;
  value:    string | number;
  pulse?:   boolean;  // .is-live red pulse
  outline?: 'teal' | 'amber' | 'green' | 'red' | 'indigo' | 'slate';
  onClick?: () => void;
}) {
  const colorMap: Record<string, string> = {
    teal:   'var(--color-teal)',
    amber:  'var(--color-amber)',
    green:  'var(--color-green)',
    red:    'var(--color-red)',
    indigo: 'var(--color-indigo)',
    slate:  'var(--color-text-muted)',
  };
  const col    = colorMap[outline ?? 'slate'];
  const isPulse = pulse ?? false;

  return (
    <button
      onClick={onClick}
      aria-label={`${label}: ${value}`}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            6,
        padding:        '0 10px',
        height:         26,
        borderRadius:   6,
        border:         `1px solid ${col}${isPulse ? '' : '55'}`,
        background:     isPulse ? `${col}18` : 'transparent',
        cursor:         onClick ? 'pointer' : 'default',
        fontFamily:     'var(--font-body)',
        transition:     'background 150ms',
        flexShrink:     0,
        whiteSpace:     'nowrap' as const,
      }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLElement).style.background = `${col}28`; }}
      onMouseLeave={e => { if (onClick) (e.currentTarget as HTMLElement).style.background = isPulse ? `${col}18` : 'transparent'; }}
    >
      {/* Live pulse dot */}
      {isPulse && (
        <span
          className="is-live"
          aria-hidden="true"
          style={{
            display:      'block',
            width:        7,
            height:       7,
            borderRadius: '50%',
            background:   col,
            flexShrink:   0,
          }}
        />
      )}
      {/* Label */}
      <span style={{
        fontSize:      11,
        fontWeight:    500,
        color:         'var(--color-text-muted)',
        letterSpacing: '0.02em',
      }}>
        {label}:
      </span>
      {/* Value */}
      <span style={{
        fontSize:   13,
        fontWeight: 700,
        color:      col,
        fontFamily: 'var(--font-display)',
      }}>
        {value}
      </span>
    </button>
  );
}

// ── Separator ──────────────────────────────────────────────────
function Sep() {
  return (
    <span aria-hidden="true" style={{
      display:    'block',
      width:      1,
      height:     16,
      background: 'var(--color-border)',
      flexShrink: 0,
    }} />
  );
}

// ══ INTEL STRIP ═══════════════════════════════════════════════
export default function IntelStrip() {
  const navigate        = useNavigate();
  const { isAdmin, isManager } = usePermissions();
  const [lastUpdated, setLastUpdated] = useState<string>('—');
  const [fetchOk,     setFetchOk]     = useState(true);

  const { data } = useQuery<IntelData>({
    queryKey:        ['intel-strip'],
    queryFn:         async () => {
      const d = await reportsApi.getIntelStrip();
      setLastUpdated(nowHHMM());
      setFetchOk(true);
      return d as IntelData;
    },
    refetchInterval: 30_000,
    staleTime:       25_000,
    onError:         () => setFetchOk(false),
  } as any);

  const d: IntelData = data ?? {
    active_outages:     0,
    tasks_overdue:      0,
    staff_on_call:      0,
    avg_mttr_mins:      null,
    pending_onboarding: 0,
  };

  const showOnboarding = isAdmin || isManager;

  return (
    <div
      role="status"
      aria-label="Live operational KPI strip"
      style={{
        gridArea:       'intelstrip',
        height:         'var(--intelstrip-height)',
        background:     'var(--color-navy-light)',
        borderBottom:   '1px solid var(--color-border)',
        display:        'flex',
        alignItems:     'center',
        padding:        '0 20px',
        gap:            12,
        overflowX:      'auto',
        scrollbarWidth: 'none',
        flexShrink:     0,
      }}
    >
      {/* Active Outages — red + pulse if >0, teal outline if 0 */}
      <Chip
        label="Active Outages"
        value={d.active_outages}
        pulse={d.active_outages > 0}
        outline={d.active_outages > 0 ? 'red' : 'teal'}
        onClick={() => navigate('/outage')}
      />
      <Sep />

      {/* Overdue Tasks — amber bg if >10, slate if 0 */}
      <Chip
        label="Overdue Tasks"
        value={d.tasks_overdue}
        pulse={d.tasks_overdue > 10}
        outline={d.tasks_overdue > 10 ? 'amber' : d.tasks_overdue > 0 ? 'amber' : 'slate'}
        onClick={() => navigate('/tasks')}
      />
      <Sep />

      {/* On Call — always green outline */}
      <Chip
        label="On Call"
        value={d.staff_on_call}
        outline="green"
        onClick={() => navigate('/shifts')}
      />
      <Sep />

      {/* MTTR — indigo */}
      <Chip
        label="MTTR"
        value={formatMTTR(d.avg_mttr_mins)}
        outline="indigo"
        onClick={() => navigate('/reports')}
      />

      {/* Pending Onboarding — amber, visible to Admin/Manager only */}
      {showOnboarding && d.pending_onboarding > 0 && (
        <>
          <Sep />
          <Chip
            label="Pending Onboard"
            value={d.pending_onboarding}
            pulse={d.pending_onboarding > 0}
            outline="amber"
            onClick={() => navigate('/onboarding')}
          />
        </>
      )}

      {/* Far-right: live dot + timestamp */}
      <div style={{
        marginLeft:     'auto',
        display:        'flex',
        alignItems:     'center',
        gap:            6,
        flexShrink:     0,
      }}>
        <span
          aria-hidden="true"
          style={{
            display:      'block',
            width:        7,
            height:       7,
            borderRadius: '50%',
            background:   fetchOk ? 'var(--color-green)' : 'var(--color-red)',
            animation:    fetchOk ? 'incidentPulse 2.4s ease-in-out infinite' : 'none',
          }}
        />
        <span style={{
          fontSize:   11,
          color:      'var(--color-text-muted)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.02em',
        }}>
          Last updated {lastUpdated}
        </span>
      </div>
    </div>
  );
}
