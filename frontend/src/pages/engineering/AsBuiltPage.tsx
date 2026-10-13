// ============================================================
// OPSYN ENGINEERING AS-BUILT PAGE — Phase 39
// As-Built documentation for deployed networks
// ============================================================

import { useState } from 'react';
import { FileCheck, Camera, MapPin } from 'lucide-react';

const INPUT: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg3)',
  border: '1px solid var(--wire2)',
  borderRadius: 8,
  padding: '9px 12px',
  color: 'var(--chalk)',
  fontFamily: 'var(--font)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

export default function AsBuiltPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Placeholder - will be replaced with actual API calls in Phase 39
  const asBuiltRecords: any[] = [];

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--chalk)', margin: 0, marginBottom: 8 }}>
            As-Built Documentation
          </h1>
          <p style={{ fontSize: 14, color: 'var(--chalk3)', margin: 0 }}>
            Verified field records and as-built documentation for deployed networks
          </p>
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
            Total Records
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--chalk)' }}>0</div>
        </div>
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--wire2)',
          borderRadius: 8,
          padding: 16,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Verified
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--chalk)' }}>0</div>
        </div>
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--wire2)',
          borderRadius: 8,
          padding: 16,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--chalk3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            With Photos
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--chalk)' }}>0</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <input
          type="text"
          placeholder="Search as-built records..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...INPUT, flex: 1 }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ ...INPUT, width: 'auto', minWidth: 150 }}
        >
          <option value="all">All Status</option>
          <option value="in_progress">In Progress</option>
          <option value="submitted">Submitted</option>
          <option value="verified">Verified</option>
          <option value="finalized">Finalized</option>
        </select>
      </div>

      {/* Empty State */}
      {asBuiltRecords.length === 0 && (
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
            <FileCheck size={24} style={{ color: 'var(--chalk3)' }} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--chalk)', margin: '0 0 8px' }}>
            No as-built records yet
          </h3>
          <p style={{ fontSize: 13, color: 'var(--chalk3)', margin: 0, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
            As-built documentation is created after project deployment is completed.
            Field records include actual installed equipment locations, photos, and variance from original design.
          </p>
        </div>
      )}
    </div>
  );
}
