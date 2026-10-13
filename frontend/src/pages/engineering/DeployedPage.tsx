// ============================================================
// OPSYN ENGINEERING DEPLOYED PAGE — Phase 39
// Deployed projects workspace - tracks active deployments
// Links to deployment tracking and as-built documentation
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Hammer, FileCheck, ChevronRight, Play, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { listDeployments, type DeploymentSummary } from '../../api/deployment.api';
import { getAsBuiltStats } from '../../api/asbuilt.api';

const BUTTON: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'var(--font)',
  fontSize: 13,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const CARD_STYLE: React.CSSProperties = {
  background: 'var(--bg2)',
  border: '1px solid var(--wire2)',
  borderRadius: 12,
  padding: 24,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  marginBottom: 16,
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  planned: { bg: 'var(--bg3)', text: 'var(--chalk3)' },
  active: { bg: 'var(--color-teal-dim)', text: 'var(--color-teal)' },
  paused: { bg: 'var(--color-amber-dim)', text: 'var(--color-amber)' },
  completed: { bg: 'var(--color-green-dim)', text: 'var(--color-green)' },
  cancelled: { bg: 'var(--color-red-dim)', text: 'var(--color-red)' },
};

export default function DeployedPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch deployments
  const { data: deployments = [], isLoading } = useQuery({
    queryKey: ['deployments', statusFilter],
    queryFn: () => listDeployments(statusFilter !== 'all' ? { deployment_status: statusFilter } : undefined),
  });

  // Fetch as-built stats
  const { data: asBuiltStats } = useQuery({
    queryKey: ['asbuilt-stats'],
    queryFn: () => getAsBuiltStats(),
  });

  const activeDeployments = deployments.filter(d => d.deployment_status === 'active').length;
  const completedDeployments = deployments.filter(d => d.deployment_status === 'completed').length;

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--chalk)', margin: 0, marginBottom: 8 }}>
            Deployed Projects
          </h1>
          <p style={{ fontSize: 14, color: 'var(--chalk3)', margin: 0 }}>
            Track deployed projects and manage as-built documentation
          </p>
        </div>
      </div>

      {/* As-Built Quick Link */}
      <div
        style={CARD_STYLE}
        onClick={() => navigate('/engineering/project/deployed/as-built')}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-teal)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--wire2)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            background: 'var(--color-teal-dim)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-teal)',
            flexShrink: 0,
          }}>
            <FileCheck size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--chalk)', margin: 0, marginBottom: 4 }}>
              As-Built Documentation
            </h3>
            <p style={{ fontSize: 13, color: 'var(--chalk3)', margin: 0 }}>
              View and manage as-built records for deployed networks
            </p>
          </div>
          <ChevronRight size={20} style={{ color: 'var(--chalk3)' }} />
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--wire2)',
          borderRadius: 8,
          padding: 16,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Active Deployments
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--chalk)' }}>{activeDeployments}</div>
        </div>
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--wire2)',
          borderRadius: 8,
          padding: 16,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Completed
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--chalk)' }}>{completedDeployments}</div>
        </div>
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--wire2)',
          borderRadius: 8,
          padding: 16,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            As-Built Documented
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--chalk)' }}>
            {asBuiltStats?.finalized || 0}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['all', 'active', 'planned', 'completed', 'paused'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            style={{
              ...BUTTON,
              background: statusFilter === status ? 'var(--color-teal-dim)' : 'transparent',
              color: statusFilter === status ? 'var(--color-teal)' : 'var(--chalk3)',
              border: `1px solid ${statusFilter === status ? 'var(--color-teal)' : 'var(--wire2)'}`,
            }}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--wire2)',
          borderRadius: 12,
          padding: 48,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 13, color: 'var(--chalk3)' }}>Loading deployments...</div>
        </div>
      )}

      {/* Deployment List */}
      {!isLoading && deployments.length > 0 && (
        <div>
          {deployments.map((deployment) => (
            <DeploymentCard key={deployment.id} deployment={deployment} onClick={() => navigate(`/engineering/project/deployed/${deployment.id}`)} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && deployments.length === 0 && (
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--wire2)',
          borderRadius: 12,
          padding: 64,
          textAlign: 'center',
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: 'var(--bg3)',
            margin: '0 auto 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Hammer size={24} style={{ color: 'var(--chalk3)' }} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--chalk)', margin: '0 0 8px' }}>
            {statusFilter === 'all' ? 'No deployments yet' : `No ${statusFilter} deployments`}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--chalk3)', margin: 0, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
            Deployments are initiated from approved BOQs. Complete the design and BOQ workflow first.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Deployment Card Component ──────────────────────────────────

function DeploymentCard({
  deployment,
  onClick,
}: {
  deployment: DeploymentSummary;
  onClick: () => void;
}) {
  const statusConfig = STATUS_COLORS[deployment.deployment_status] || STATUS_COLORS.planned;
  const completionRate = deployment.milestone_count > 0
    ? (deployment.milestones_completed / deployment.milestone_count) * 100
    : deployment.completion_pct;

  return (
    <div
      style={{
        ...CARD_STYLE,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-teal)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--wire2)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Icon */}
      <div style={{
        width: 56,
        height: 56,
        borderRadius: 12,
        background: statusConfig.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: statusConfig.text,
        flexShrink: 0,
      }}>
        {deployment.deployment_status === 'active' && <Play size={24} />}
        {deployment.deployment_status === 'completed' && <CheckCircle2 size={24} />}
        {deployment.deployment_status === 'planned' && <Clock size={24} />}
        {deployment.deployment_status === 'paused' && <AlertCircle size={24} />}
        {!['active', 'completed', 'planned', 'paused'].includes(deployment.deployment_status) && <Hammer size={24} />}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 6,
              background: statusConfig.bg,
              color: statusConfig.text,
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            {deployment.deployment_status}
          </span>
          {deployment.deployment_type && (
            <span style={{ fontSize: 12, color: 'var(--chalk3)' }}>
              {deployment.deployment_type.replace('_', ' ')}
            </span>
          )}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--chalk)', marginBottom: 8 }}>
          Deployment {deployment.id.slice(0, 8)}
        </div>

        {/* Progress Bar */}
        <div style={{
          height: 6,
          background: 'var(--bg3)',
          borderRadius: 3,
          overflow: 'hidden',
          marginBottom: 8,
        }}>
          <div
            style={{
              height: '100%',
              background: statusConfig.text,
              width: `${deployment.completion_pct}%`,
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        {/* Metadata */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--chalk3)' }}>
          <span>{deployment.completion_pct}% complete</span>
          {deployment.milestone_count > 0 && (
            <span>
              {deployment.milestones_completed}/{deployment.milestone_count} milestones
            </span>
          )}
          {deployment.planned_start_date && (
            <span>
              Started {new Date(deployment.planned_start_date).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Arrow */}
      <ChevronRight size={20} style={{ color: 'var(--chalk3)', flexShrink: 0 }} />
    </div>
  );
}
