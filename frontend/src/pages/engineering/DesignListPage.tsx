// ============================================================
// OPSYN ENGINEERING DESIGN LIST PAGE — Phase 25
// Lists all designs with filters, actions, and navigation
// ============================================================

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { designApi } from '../../api/design.api';
import { useUIStore } from '../../store/ui.store';
import type { Design, DesignStatus } from '@shared';
import {
  Plus, Search, Filter, Network, Pen, Clock, CheckCircle,
  AlertCircle, FileText, ChevronRight, Loader2
} from 'lucide-react';

// ── Status Configuration ──────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  DRAFT:     { label: 'Draft',     color: 'var(--color-text-muted)', bg: 'var(--color-surface-2)', icon: <Pen size={12} /> },
  MODIFIED:  { label: 'Modified',  color: 'var(--color-amber)',      bg: 'rgba(245,158,11,.10)',  icon: <AlertCircle size={12} /> },
  SUBMITTED: { label: 'Submitted', color: 'var(--color-blue)',       bg: 'rgba(59,130,246,.10)',  icon: <Clock size={12} /> },
  APPROVED:  { label: 'Approved',  color: 'var(--color-green)',      bg: 'rgba(22,163,74,.10)',   icon: <CheckCircle size={12} /> },
  REJECTED:  { label: 'Rejected',  color: 'var(--color-red)',        bg: 'rgba(220,38,38,.10)',   icon: <AlertCircle size={12} /> },
  DEPLOYED:  { label: 'Deployed',  color: 'var(--color-teal)',       bg: 'rgba(0,194,168,.10)',   icon: <Network size={12} /> },
};

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'MODIFIED', label: 'Modified' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'DEPLOYED', label: 'Deployed' },
];

// ── Styles ─────────────────────────────────────────────────────

const CONTAINER: React.CSSProperties = {
  padding: 24,
  maxWidth: 1400,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  overflow: 'hidden',
};

const HEADER: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: 24,
};

const INPUT: React.CSSProperties = {
  background: 'var(--bg3)',
  border: '1px solid var(--wire2)',
  borderRadius: 8,
  padding: '10px 12px',
  color: 'var(--chalk)',
  fontFamily: 'var(--font)',
  fontSize: 13,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const BUTTON = (primary?: boolean): React.CSSProperties => ({
  padding: '10px 18px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'var(--font)',
  fontSize: 13,
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  background: primary ? 'var(--color-teal)' : 'var(--bg3)',
  color: primary ? '#fff' : 'var(--chalk)',
  transition: 'all .15s',
});

const CARD: React.CSSProperties = {
  background: 'var(--bg2)',
  border: '1px solid var(--wire2)',
  borderRadius: 12,
  padding: '16px 20px',
  cursor: 'pointer',
  transition: 'all .2s ease',
};

const STAT_CARD: React.CSSProperties = {
  background: 'var(--bg2)',
  border: '1px solid var(--wire2)',
  borderRadius: 10,
  padding: 16,
};

// ── Components ─────────────────────────────────────────────────

interface DesignCardProps {
  design: Design;
  onClick: () => void;
}

function DesignCard({ design, onClick }: DesignCardProps) {
  const statusConfig = STATUS_CONFIG[design.status as string] || STATUS_CONFIG.DRAFT;
  const createdDate = design.created_at
    ? new Date(design.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
  const updatedDate = design.updated_at
    ? new Date(design.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  return (
    <div
      style={CARD}
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
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--chalk)',
            margin: 0,
            marginBottom: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {design.name}
          </h3>
          {design.description && (
            <p style={{
              fontSize: 12,
              color: 'var(--chalk3)',
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {design.description}
            </p>
          )}
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 6,
          background: statusConfig.bg,
          color: statusConfig.color,
          fontSize: 11,
          fontWeight: 600,
          flexShrink: 0,
          marginLeft: 12,
        }}>
          {statusConfig.icon}
          {statusConfig.label}
        </div>
      </div>

      {/* Footer row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--chalk3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span>Created {createdDate}</span>
          {design.updated_at !== design.created_at && (
            <span>Updated {updatedDate}</span>
          )}
        </div>
        <ChevronRight size={16} style={{ color: 'var(--chalk3)' }} />
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────

export default function DesignListPage() {
  const navigate = useNavigate();
  const { addToast } = useUIStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Fetch designs - using the design API which already exists
  const { data: designs, isLoading, error } = useQuery({
    queryKey: ['designs', 'all'],
    queryFn: async () => {
      // The designApi.list requires a projectId, but we want all designs
      // For now, we'll use the engineering/designs endpoint
      const response = await fetch('/api/v1/engineering/designs', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const json = await response.json();
      return json.data as Design[];
    },
    staleTime: 60_000,
  });

  // Filter designs
  const filteredDesigns = useMemo(() => {
    if (!designs) return [];
    let result = designs;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(d =>
        d.name.toLowerCase().includes(q) ||
        (d.description?.toLowerCase().includes(q) ?? false)
      );
    }

    if (statusFilter) {
      result = result.filter(d => d.status === statusFilter);
    }

    return result;
  }, [designs, search, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    if (!designs) return { total: 0, draft: 0, approved: 0, deployed: 0 };
    return {
      total: designs.length,
      draft: designs.filter(d => d.status === 'DRAFT' || d.status === 'MODIFIED').length,
      approved: designs.filter(d => d.status === 'APPROVED').length,
      deployed: designs.filter(d => d.status === 'DEPLOYED').length,
    };
  }, [designs]);

  const handleCreateDesign = () => {
    // Navigate to FTTx Designer for auto design
    navigate('/fttx-designer');
  };

  const handleDesignClick = (design: Design) => {
    // Navigate to design detail or FTTx designer
    navigate(`/fttx-designer/${design.id}`);
  };

  if (error) {
    return (
      <div style={CONTAINER}>
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--color-red)' }}>
          <AlertCircle size={32} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>Failed to load designs</div>
          <div style={{ fontSize: 12, color: 'var(--chalk3)', marginTop: 4 }}>
            Please try refreshing the page
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={CONTAINER}>
      {/* Header */}
      <div style={HEADER}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--chalk)', margin: 0, marginBottom: 8 }}>
            Network Designs
          </h1>
          <p style={{ fontSize: 14, color: 'var(--chalk3)', margin: 0 }}>
            Create and manage network designs using auto or manual tools
          </p>
        </div>
        <button style={BUTTON(true)} onClick={handleCreateDesign}>
          <Plus size={16} />
          New Design
        </button>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        marginBottom: 24,
      }}>
        <div style={STAT_CARD}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Designs
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--chalk)' }}>{stats.total}</div>
        </div>
        <div style={STAT_CARD}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            In Progress
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-amber)' }}>{stats.draft}</div>
        </div>
        <div style={STAT_CARD}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Approved
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-green)' }}>{stats.approved}</div>
        </div>
        <div style={STAT_CARD}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Deployed
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-teal)' }}>{stats.deployed}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--chalk3)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search designs..."
            style={{ ...INPUT, paddingLeft: 36 }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            ...INPUT,
            width: 160,
            cursor: 'pointer',
          }}
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Design List */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--chalk3)' }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
            <div style={{ fontSize: 13 }}>Loading designs...</div>
          </div>
        ) : filteredDesigns.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: 80,
            background: 'var(--bg2)',
            border: '1px solid var(--wire2)',
            borderRadius: 12,
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
              {search || statusFilter ? 'No designs match your filters' : 'No designs yet'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--chalk3)', margin: 0, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
              {search || statusFilter
                ? 'Try adjusting your search or filter criteria.'
                : 'Create your first network design using the FTTx Designer or manual design tools.'}
            </p>
            {!search && !statusFilter && (
              <button style={{ ...BUTTON(true), marginTop: 20 }} onClick={handleCreateDesign}>
                <Plus size={16} />
                Create Design
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredDesigns.map(design => (
              <DesignCard
                key={design.id}
                design={design}
                onClick={() => handleDesignClick(design)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
