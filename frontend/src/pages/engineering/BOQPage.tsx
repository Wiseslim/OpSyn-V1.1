// ============================================================
// OPSYN BOQ PAGE — Phase 35 Complete
// Bill of Quantities management interface
// List, view, edit, approve, and export BOQs
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  FileText,
  Search,
  Eye,
  Edit,
  Trash2,
  Check,
  X,
  Download,
  FileSpreadsheet,
  FileDown,
  ChevronRight,
} from 'lucide-react';
import {
  listBOQs,
  deleteBOQ,
  submitBOQ,
  approveBOQ,
  rejectBOQ,
  exportBOQToExcel,
  exportBOQToPDF,
  getBOQStats,
  type BOQSummary,
} from '../../api/boq.api';

// ── Styles ─────────────────────────────────────────────────────

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
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  marginBottom: 16,
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'rgba(250,204,21,0.15)', text: '#FBBF24' },
  submitted: { bg: 'var(--color-blue-dim)', text: 'var(--color-blue)' },
  approved: { bg: 'var(--color-green-dim)', text: 'var(--color-green)' },
  rejected: { bg: 'var(--color-red-dim)', text: 'var(--color-red)' },
};

export default function BOQPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch BOQs
  const { data: boqs = [], isLoading } = useQuery({
    queryKey: ['boqs', statusFilter],
    queryFn: () => listBOQs(statusFilter !== 'all' ? { boq_status: statusFilter } : undefined),
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['boq-stats'],
    queryFn: () => getBOQStats(),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteBOQ,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boqs'] });
      queryClient.invalidateQueries({ queryKey: ['boq-stats'] });
    },
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: (boqId: string) => submitBOQ(boqId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boqs'] });
      queryClient.invalidateQueries({ queryKey: ['boq-stats'] });
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (boqId: string) => approveBOQ(boqId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boqs'] });
      queryClient.invalidateQueries({ queryKey: ['boq-stats'] });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: (boqId: string) => rejectBOQ(boqId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boqs'] });
      queryClient.invalidateQueries({ queryKey: ['boq-stats'] });
    },
  });

  const handleDelete = async (e: React.MouseEvent, boqId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this BOQ?')) return;
    deleteMutation.mutate(boqId);
  };

  const handleSubmit = async (e: React.MouseEvent, boqId: string) => {
    e.stopPropagation();
    if (!confirm('Submit this BOQ for approval?')) return;
    submitMutation.mutate(boqId);
  };

  const handleApprove = async (e: React.MouseEvent, boqId: string) => {
    e.stopPropagation();
    if (!confirm('Approve this BOQ?')) return;
    approveMutation.mutate(boqId);
  };

  const handleReject = async (e: React.MouseEvent, boqId: string) => {
    e.stopPropagation();
    if (!confirm('Reject this BOQ?')) return;
    rejectMutation.mutate(boqId);
  };

  const handleExportExcel = async (e: React.MouseEvent, boqId: string) => {
    e.stopPropagation();
    try {
      const blob = await exportBOQToExcel(boqId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BOQ-${boqId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export BOQ to Excel');
    }
  };

  const handleExportPDF = async (e: React.MouseEvent, boqId: string) => {
    e.stopPropagation();
    try {
      const blob = await exportBOQToPDF(boqId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BOQ-${boqId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export BOQ to PDF');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const filteredBOQs = boqs.filter((boq) => {
    const matchesSearch =
      !searchQuery || boq.boq_number?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--chalk)', margin: 0, marginBottom: 8 }}>
            Bill of Quantities
          </h1>
          <p style={{ fontSize: 14, color: 'var(--chalk3)', margin: 0 }}>
            Manage project materials, labor, and costs
          </p>
        </div>
        <button
          onClick={() => navigate('/engineering/project/boq/new')}
          style={{ ...BUTTON, background: 'var(--color-teal)', color: '#fff' }}
        >
          <Plus size={16} />
          Create BOQ
        </button>
      </div>

      {/* Statistics */}
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
            Total BOQs
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--chalk)' }}>
            {stats?.total || boqs.length}
          </div>
        </div>
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--wire2)',
          borderRadius: 8,
          padding: 16,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pending Approval
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--chalk)' }}>
            {stats?.submitted || boqs.filter(b => b.boq_status === 'submitted').length}
          </div>
        </div>
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--wire2)',
          borderRadius: 8,
          padding: 16,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Approved
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--chalk)' }}>
            {stats?.approved || boqs.filter(b => b.boq_status === 'approved').length}
          </div>
        </div>
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--wire2)',
          borderRadius: 8,
          padding: 16,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Value
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--chalk)' }}>
            {formatCurrency(stats?.total_value || boqs.reduce((sum, b) => sum + b.total_cost, 0))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--chalk3)',
            }}
          />
          <input
            type="text"
            placeholder="Search BOQs by number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 12px 10px 40px',
              background: 'var(--bg2)',
              border: '1px solid var(--wire2)',
              borderRadius: 8,
              color: 'var(--chalk)',
              fontFamily: 'var(--font)',
              fontSize: 13,
              outline: 'none',
              width: '100%',
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '10px 14px',
            background: 'var(--bg2)',
            border: '1px solid var(--wire2)',
            borderRadius: 8,
            color: 'var(--chalk)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font)',
          }}
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
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
          <div style={{ fontSize: 13, color: 'var(--chalk3)' }}>Loading BOQs...</div>
        </div>
      )}

      {/* BOQ List */}
      {!isLoading && filteredBOQs.length > 0 && (
        <div>
          {filteredBOQs.map((boq) => (
            <BOQCard
              key={boq.id}
              boq={boq}
              onView={() => navigate(`/engineering/project/boq/${boq.id}`)}
              onEdit={() => navigate(`/engineering/project/boq/${boq.id}/edit`)}
              onDelete={(e) => handleDelete(e, boq.id)}
              onSubmit={(e) => handleSubmit(e, boq.id)}
              onApprove={(e) => handleApprove(e, boq.id)}
              onReject={(e) => handleReject(e, boq.id)}
              onExportExcel={(e) => handleExportExcel(e, boq.id)}
              onExportPDF={(e) => handleExportPDF(e, boq.id)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredBOQs.length === 0 && (
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
            <FileText size={24} style={{ color: 'var(--chalk3)' }} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--chalk)', margin: '0 0 8px' }}>
            No BOQs found
          </h3>
          <p style={{ fontSize: 13, color: 'var(--chalk3)', margin: 0, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'BOQs are generated from approved network designs. Create a design first, then generate its BOQ.'}
          </p>
        </div>
      )}
    </div>
  );
}

// ── BOQ Card Component ──────────────────────────────────────────

function BOQCard({
  boq,
  onView,
  onEdit,
  onDelete,
  onSubmit,
  onApprove,
  onReject,
  onExportExcel,
  onExportPDF,
}: {
  boq: BOQSummary;
  onView: () => void;
  onEdit: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onSubmit: (e: React.MouseEvent) => void;
  onApprove: (e: React.MouseEvent) => void;
  onReject: (e: React.MouseEvent) => void;
  onExportExcel: (e: React.MouseEvent) => void;
  onExportPDF: (e: React.MouseEvent) => void;
}) {
  const statusConfig = STATUS_COLORS[boq.boq_status] || STATUS_COLORS.draft;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div
      style={{
        ...CARD,
      }}
      onClick={onView}
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
          <FileText size={24} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--chalk)', fontFamily: 'var(--font-mono)' }}>
              {boq.boq_number || `Draft-${boq.id.slice(0, 8)}`}
            </span>
            <span
              style={{
                padding: '3px 10px',
                borderRadius: 6,
                background: statusConfig.bg,
                color: statusConfig.text,
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {boq.boq_status}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--chalk3)', marginBottom: 8 }}>
            <span>{boq.item_count} items</span>
            <span>Created {formatDate(boq.created_at)}</span>
            {boq.submitted_at && <span>Submitted {formatDate(boq.submitted_at)}</span>}
          </div>

          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--chalk)' }}>
            {formatCurrency(boq.total_cost)}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          {boq.boq_status === 'draft' && (
            <>
              <button
                onClick={onEdit}
                style={{
                  ...BUTTON,
                  background: 'var(--bg3)',
                  color: 'var(--chalk)',
                  padding: '6px 12px',
                  fontSize: 12,
                }}
                title="Edit"
              >
                <Edit size={14} />
                Edit
              </button>
              <button
                onClick={onSubmit}
                style={{
                  ...BUTTON,
                  background: 'var(--color-blue)',
                  color: 'white',
                  padding: '6px 12px',
                  fontSize: 12,
                }}
                title="Submit for Approval"
              >
                <Check size={14} />
                Submit
              </button>
              <button
                onClick={onDelete}
                style={{
                  ...BUTTON,
                  background: 'transparent',
                  color: 'var(--color-red)',
                  padding: '6px',
                }}
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}

          {boq.boq_status === 'submitted' && (
            <>
              <button
                onClick={onApprove}
                style={{
                  ...BUTTON,
                  background: 'var(--color-green)',
                  color: 'white',
                  padding: '6px 12px',
                  fontSize: 12,
                }}
                title="Approve"
              >
                <Check size={14} />
                Approve
              </button>
              <button
                onClick={onReject}
                style={{
                  ...BUTTON,
                  background: 'var(--color-red)',
                  color: 'white',
                  padding: '6px 12px',
                  fontSize: 12,
                }}
                title="Reject"
              >
                <X size={14} />
                Reject
              </button>
            </>
          )}

          {(boq.boq_status === 'approved' || boq.boq_status === 'submitted') && (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const menu = e.currentTarget.nextElementSibling as HTMLElement;
                  if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                }}
                style={{
                  ...BUTTON,
                  background: 'var(--bg3)',
                  color: 'var(--chalk)',
                  padding: '6px 12px',
                  fontSize: 12,
                }}
                title="Export"
              >
                <Download size={14} />
                Export
              </button>
              <div
                style={{
                  display: 'none',
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: 4,
                  background: 'var(--bg2)',
                  border: '1px solid var(--wire2)',
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 10,
                  minWidth: 140,
                }}
              >
                <button
                  onClick={onExportExcel}
                  style={{
                    ...BUTTON,
                    background: 'transparent',
                    color: 'var(--chalk)',
                    padding: '8px 12px',
                    fontSize: 12,
                    width: '100%',
                    justifyContent: 'flex-start',
                    borderRadius: '8px 8px 0 0',
                  }}
                >
                  <FileSpreadsheet size={14} />
                  Excel
                </button>
                <button
                  onClick={onExportPDF}
                  style={{
                    ...BUTTON,
                    background: 'transparent',
                    color: 'var(--chalk)',
                    padding: '8px 12px',
                    fontSize: 12,
                    width: '100%',
                    justifyContent: 'flex-start',
                    borderRadius: '0 0 8px 8px',
                  }}
                >
                  <FileDown size={14} />
                  PDF
                </button>
              </div>
            </div>
          )}

          <ChevronRight size={20} style={{ color: 'var(--chalk3)' }} />
        </div>
      </div>
    </div>
  );
}
