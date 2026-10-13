// ============================================================
// OPSYN DEPLOYMENT DASHBOARD — Phase 39
// Complete deployment tracking with milestones and as-built
// ============================================================

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  Users,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Pause,
  Play,
  XCircle,
  FileText,
  Camera,
  MapPin,
  TrendingUp,
} from 'lucide-react';
import {
  getDeployment,
  updateDeploymentProgress,
  updateMilestone,
  type Deployment,
  type DeploymentMilestone,
} from '../../api/deployment.api';
import {
  listAsBuiltRecords,
  getAsBuiltVariance,
  type AsBuiltSummary,
  type VarianceStats,
} from '../../api/asbuilt.api';

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
  transition: 'all 0.15s ease',
};

const CARD: React.CSSProperties = {
  background: 'var(--bg2)',
  border: '1px solid var(--wire2)',
  borderRadius: 12,
  padding: 24,
  marginBottom: 24,
};

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: any }> = {
  planned: { bg: 'var(--bg3)', text: 'var(--chalk3)', icon: Calendar },
  active: { bg: 'var(--color-teal-dim)', text: 'var(--color-teal)', icon: Play },
  paused: { bg: 'var(--color-amber-dim)', text: 'var(--color-amber)', icon: Pause },
  completed: { bg: 'var(--color-green-dim)', text: 'var(--color-green)', icon: CheckCircle2 },
  cancelled: { bg: 'var(--color-red-dim)', text: 'var(--color-red)', icon: XCircle },
};

const MILESTONE_STATUS_COLORS: Record<string, { bg: string; text: string; icon: any }> = {
  pending: { bg: 'var(--bg3)', text: 'var(--chalk3)', icon: Circle },
  in_progress: { bg: 'var(--color-teal-dim)', text: 'var(--color-teal)', icon: Clock },
  completed: { bg: 'var(--color-green-dim)', text: 'var(--color-green)', icon: CheckCircle2 },
  blocked: { bg: 'var(--color-red-dim)', text: 'var(--color-red)', icon: AlertCircle },
  skipped: { bg: 'var(--bg3)', text: 'var(--chalk3)', icon: XCircle },
};

export default function DeploymentDashboard() {
  const { deploymentId } = useParams<{ deploymentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState<'overview' | 'milestones' | 'asbuilt'>('overview');

  // Fetch deployment
  const { data: deployment, isLoading } = useQuery({
    queryKey: ['deployment', deploymentId],
    queryFn: () => getDeployment(deploymentId!),
    enabled: !!deploymentId,
  });

  // Fetch as-built records
  const { data: asBuiltRecords = [] } = useQuery({
    queryKey: ['asbuilt-records', deploymentId],
    queryFn: () => listAsBuiltRecords({ deployment_id: deploymentId }),
    enabled: !!deploymentId,
  });

  // Fetch variance stats if as-built exists
  const asBuiltId = asBuiltRecords[0]?.id;
  const { data: varianceStats } = useQuery({
    queryKey: ['asbuilt-variance', asBuiltId],
    queryFn: () => getAsBuiltVariance(asBuiltId!),
    enabled: !!asBuiltId,
  });

  // Update progress mutation
  const updateProgressMutation = useMutation({
    mutationFn: ({ completion_pct, notes }: { completion_pct: number; notes?: string }) =>
      updateDeploymentProgress(deploymentId!, { completion_pct, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment', deploymentId] });
    },
  });

  // Update milestone mutation
  const updateMilestoneMutation = useMutation({
    mutationFn: ({ milestoneId, data }: { milestoneId: string; data: any }) =>
      updateMilestone(deploymentId!, milestoneId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment', deploymentId] });
    },
  });

  if (isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ color: 'var(--chalk3)', fontSize: 14 }}>Loading deployment...</div>
      </div>
    );
  }

  if (!deployment) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ color: 'var(--chalk3)', fontSize: 14 }}>Deployment not found</div>
      </div>
    );
  }

  const statusConfig = STATUS_COLORS[deployment.deployment_status] || STATUS_COLORS.planned;
  const StatusIcon = statusConfig.icon;

  const completedMilestones = deployment.milestones.filter(m => m.milestone_status === 'completed').length;
  const totalMilestones = deployment.milestones.length;

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => navigate('/engineering/project/deployed')}
          style={{
            ...BUTTON,
            background: 'transparent',
            color: 'var(--chalk3)',
            padding: '8px 12px',
            marginBottom: 16,
          }}
        >
          <ArrowLeft size={16} />
          Back to Deployments
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--chalk)', margin: 0, marginBottom: 8 }}>
              Deployment Details
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span
                style={{
                  padding: '4px 12px',
                  borderRadius: 6,
                  background: statusConfig.bg,
                  color: statusConfig.text,
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <StatusIcon size={14} />
                {deployment.deployment_status.toUpperCase()}
              </span>
              {deployment.deployment_type && (
                <span style={{ fontSize: 13, color: 'var(--chalk3)' }}>
                  {deployment.deployment_type.replace('_', ' ').toUpperCase()}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => navigate(`/engineering/project/deployed/as-built/new?deployment=${deploymentId}`)}
            style={{
              ...BUTTON,
              background: 'var(--color-teal)',
              color: 'white',
            }}
          >
            <Camera size={16} />
            Create As-Built
          </button>
        </div>
      </div>

      {/* Progress Overview */}
      <div style={CARD}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--chalk)', margin: 0 }}>
            Overall Progress
          </h2>
          <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--chalk)' }}>
            {deployment.completion_pct}%
          </span>
        </div>

        <div style={{
          height: 12,
          background: 'var(--bg3)',
          borderRadius: 6,
          overflow: 'hidden',
          marginBottom: 24,
        }}>
          <div
            style={{
              height: '100%',
              background: `linear-gradient(90deg, var(--color-teal), var(--color-teal-bright))`,
              width: `${deployment.completion_pct}%`,
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Planned Start
            </div>
            <div style={{ fontSize: 14, color: 'var(--chalk)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={14} style={{ color: 'var(--chalk3)' }} />
              {deployment.planned_start_date ? new Date(deployment.planned_start_date).toLocaleDateString() : 'Not set'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Planned End
            </div>
            <div style={{ fontSize: 14, color: 'var(--chalk)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={14} style={{ color: 'var(--chalk3)' }} />
              {deployment.planned_end_date ? new Date(deployment.planned_end_date).toLocaleDateString() : 'Not set'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Milestones
            </div>
            <div style={{ fontSize: 14, color: 'var(--chalk)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={14} style={{ color: 'var(--chalk3)' }} />
              {completedMilestones} / {totalMilestones} completed
            </div>
          </div>
          {deployment.crew_lead_id && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Crew Lead
              </div>
              <div style={{ fontSize: 14, color: 'var(--chalk)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={14} style={{ color: 'var(--chalk3)' }} />
                Assigned
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 8,
        borderBottom: '1px solid var(--wire2)',
        marginBottom: 24,
      }}>
        {(['overview', 'milestones', 'asbuilt'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            style={{
              ...BUTTON,
              background: 'transparent',
              color: selectedTab === tab ? 'var(--color-teal)' : 'var(--chalk3)',
              borderBottom: selectedTab === tab ? '2px solid var(--color-teal)' : '2px solid transparent',
              borderRadius: 0,
              padding: '12px 16px',
            }}
          >
            {tab === 'overview' && 'Overview'}
            {tab === 'milestones' && 'Milestones'}
            {tab === 'asbuilt' && 'As-Built'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {selectedTab === 'overview' && (
        <OverviewTab deployment={deployment} asBuiltRecords={asBuiltRecords} varianceStats={varianceStats} />
      )}

      {selectedTab === 'milestones' && (
        <MilestonesTab
          milestones={deployment.milestones}
          onUpdateMilestone={(milestoneId, data) => updateMilestoneMutation.mutate({ milestoneId, data })}
        />
      )}

      {selectedTab === 'asbuilt' && (
        <AsBuiltTab
          deploymentId={deploymentId!}
          asBuiltRecords={asBuiltRecords}
          varianceStats={varianceStats}
        />
      )}
    </div>
  );
}

// ── Overview Tab ────────────────────────────────────────────────

function OverviewTab({
  deployment,
  asBuiltRecords,
  varianceStats,
}: {
  deployment: Deployment;
  asBuiltRecords: AsBuiltSummary[];
  varianceStats?: VarianceStats;
}) {
  return (
    <div>
      {/* Notes */}
      {deployment.notes && (
        <div style={CARD}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--chalk)', margin: '0 0 12px' }}>
            Deployment Notes
          </h3>
          <p style={{ fontSize: 13, color: 'var(--chalk3)', margin: 0, lineHeight: 1.6 }}>
            {deployment.notes}
          </p>
        </div>
      )}

      {/* As-Built Summary */}
      {asBuiltRecords.length > 0 && (
        <div style={CARD}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--chalk)', margin: '0 0 16px' }}>
            As-Built Documentation
          </h3>
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
            }}>
              <FileText size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--chalk)', marginBottom: 4 }}>
                {asBuiltRecords.length} record(s) created
              </div>
              <div style={{ fontSize: 13, color: 'var(--chalk3)' }}>
                {asBuiltRecords[0].item_count} items documented
              </div>
            </div>
            {varianceStats && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', marginBottom: 4, textTransform: 'uppercase' }}>
                  Avg Variance
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--chalk)' }}>
                  {varianceStats.avg_location_variance_m.toFixed(1)}m
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {asBuiltRecords.length === 0 && (
        <div style={{
          ...CARD,
          textAlign: 'center',
          padding: 48,
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
            <FileText size={24} style={{ color: 'var(--chalk3)' }} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--chalk)', margin: '0 0 8px' }}>
            No as-built documentation yet
          </h3>
          <p style={{ fontSize: 13, color: 'var(--chalk3)', margin: 0 }}>
            Create as-built records to document actual deployment vs design
          </p>
        </div>
      )}
    </div>
  );
}

// ── Milestones Tab ──────────────────────────────────────────────

function MilestonesTab({
  milestones,
  onUpdateMilestone,
}: {
  milestones: DeploymentMilestone[];
  onUpdateMilestone: (milestoneId: string, data: any) => void;
}) {
  if (milestones.length === 0) {
    return (
      <div style={{
        ...CARD,
        textAlign: 'center',
        padding: 48,
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
          <CheckCircle2 size={24} style={{ color: 'var(--chalk3)' }} />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--chalk)', margin: '0 0 8px' }}>
          No milestones defined
        </h3>
        <p style={{ fontSize: 13, color: 'var(--chalk3)', margin: 0 }}>
          Milestones help track deployment progress step by step
        </p>
      </div>
    );
  }

  return (
    <div style={CARD}>
      {milestones.map((milestone, index) => {
        const statusConfig = MILESTONE_STATUS_COLORS[milestone.milestone_status] || MILESTONE_STATUS_COLORS.pending;
        const StatusIcon = statusConfig.icon;

        return (
          <div
            key={milestone.id}
            style={{
              padding: 16,
              border: '1px solid var(--wire2)',
              borderRadius: 8,
              marginBottom: index < milestones.length - 1 ? 12 : 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: statusConfig.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: statusConfig.text,
                flexShrink: 0,
              }}>
                <StatusIcon size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--chalk)' }}>
                    {milestone.milestone_name}
                  </span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: statusConfig.bg,
                      color: statusConfig.text,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {milestone.milestone_status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                {milestone.description && (
                  <p style={{ fontSize: 13, color: 'var(--chalk3)', margin: '0 0 8px', lineHeight: 1.5 }}>
                    {milestone.description}
                  </p>
                )}
                {milestone.due_date && (
                  <div style={{ fontSize: 12, color: 'var(--chalk3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={12} />
                    Due: {new Date(milestone.due_date).toLocaleDateString()}
                  </div>
                )}
              </div>
              {milestone.milestone_status !== 'completed' && (
                <button
                  onClick={() => onUpdateMilestone(milestone.id, { milestone_status: 'completed', completed_date: new Date().toISOString().split('T')[0] })}
                  style={{
                    ...BUTTON,
                    background: 'var(--color-green)',
                    color: 'white',
                    padding: '6px 12px',
                    fontSize: 12,
                  }}
                >
                  <CheckCircle2 size={14} />
                  Mark Complete
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── As-Built Tab ────────────────────────────────────────────────

function AsBuiltTab({
  deploymentId,
  asBuiltRecords,
  varianceStats,
}: {
  deploymentId: string;
  asBuiltRecords: AsBuiltSummary[];
  varianceStats?: VarianceStats;
}) {
  const navigate = useNavigate();

  if (asBuiltRecords.length === 0) {
    return (
      <div style={{
        ...CARD,
        textAlign: 'center',
        padding: 48,
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
          <Camera size={24} style={{ color: 'var(--chalk3)' }} />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--chalk)', margin: '0 0 8px' }}>
          No as-built records yet
        </h3>
        <p style={{ fontSize: 13, color: 'var(--chalk3)', margin: '0 0 16px' }}>
          Document actual deployment results with photos and variance tracking
        </p>
        <button
          onClick={() => navigate(`/engineering/project/deployed/as-built/new?deployment=${deploymentId}`)}
          style={{
            ...BUTTON,
            background: 'var(--color-teal)',
            color: 'white',
            margin: '0 auto',
          }}
        >
          <Camera size={16} />
          Create As-Built Record
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Variance Summary */}
      {varianceStats && (
        <div style={CARD}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--chalk)', margin: '0 0 16px' }}>
            Variance Statistics
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 16,
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', marginBottom: 4, textTransform: 'uppercase' }}>
                Total Items
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--chalk)' }}>
                {varianceStats.total_items}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', marginBottom: 4, textTransform: 'uppercase' }}>
                Avg Variance
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--chalk)' }}>
                {varianceStats.avg_location_variance_m.toFixed(1)}m
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', marginBottom: 4, textTransform: 'uppercase' }}>
                Max Variance
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--chalk)' }}>
                {varianceStats.max_location_variance_m.toFixed(1)}m
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', marginBottom: 4, textTransform: 'uppercase' }}>
                Within Tolerance
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-green)' }}>
                {varianceStats.items_within_tolerance}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* As-Built Records List */}
      {asBuiltRecords.map((record) => (
        <div
          key={record.id}
          style={{
            ...CARD,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onClick={() => navigate(`/engineering/project/deployed/as-built/${record.id}`)}
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
            }}>
              <FileText size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--chalk)', marginBottom: 4 }}>
                As-Built Record
              </div>
              <div style={{ fontSize: 13, color: 'var(--chalk3)' }}>
                {record.item_count} items • {record.as_built_status}
              </div>
            </div>
            {record.design_variance_pct !== null && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', marginBottom: 4, textTransform: 'uppercase' }}>
                  Variance
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--chalk)' }}>
                  {record.design_variance_pct.toFixed(1)}%
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
