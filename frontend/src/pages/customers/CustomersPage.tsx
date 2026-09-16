// ============================================================
// OPSYN CUSTOMERS PAGE — src/pages/customers/CustomersPage.tsx
// List · filters · create modal · CSV export
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomers, useCreateCustomer } from '../../hooks/useCustomers';
import { useUIStore } from '../../store/ui.store';
import { customersApi } from '../../api/customers.api';

// ── helpers ───────────────────────────────────────────────────

function useToast() {
  const { addToast } = useUIStore();
  return {
    success: (title: string, msg?: string) => addToast({ type: 'success', title, message: msg }),
    error:   (title: string, msg?: string) => addToast({ type: 'error',   title, message: msg }),
  };
}

const STATUS_COLOR: Record<string, string> = {
  pending:   '#f59e0b',
  active:    '#16a34a',
  suspended: '#dc2626',
  churned:   '#94a3b8',
};

const SOURCE_LABELS: Record<string, string> = {
  field_tech:       'Field Tech',
  hr:               'HR',
  sales:            'Sales',
  coverage_checker: 'Coverage',
  manual:           'Manual',
};

// ── Create Customer Modal ─────────────────────────────────────

interface CreateModalProps {
  onClose:   () => void;
  onCreated: () => void;
}

function CreateCustomerModal({ onClose, onCreated }: CreateModalProps) {
  const toast  = useToast();
  const create = useCreateCustomer();

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', address: '',
    source_app: 'manual', amount: '', currency: 'NGN',
  });

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error('First and last name are required.');
      return;
    }
    try {
      await create.mutateAsync({
        first_name: form.first_name.trim(),
        last_name:  form.last_name.trim(),
        email:      form.email || undefined,
        phone:      form.phone || undefined,
        address:    form.address || undefined,
        source_app: form.source_app,
        amount:     form.amount ? parseFloat(form.amount) : 0,
        currency:   form.currency,
      });
      toast.success('Customer created');
      onCreated();
    } catch (e: any) {
      toast.error('Failed to create customer', e?.response?.data?.detail ?? String(e));
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 7, boxSizing: 'border-box',
    border: '1px solid var(--color-border)', background: 'var(--color-surface)',
    color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)', fontSize: 12,
    outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)',
    textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4, display: 'block',
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--color-surface)', borderRadius: 14, padding: 28,
        width: 480, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,.25)', border: '1px solid var(--color-border)',
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 20 }}>
          New Customer
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>First Name *</label>
              <input style={inputStyle} value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="Jane" required />
            </div>
            <div>
              <label style={labelStyle}>Last Name *</label>
              <input style={inputStyle} value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Doe" required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@example.com" />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+234…" />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Address</label>
            <input style={inputStyle} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Street, City" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Source</label>
              <select style={inputStyle} value={form.source_app} onChange={e => set('source_app', e.target.value)}>
                {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Amount</label>
              <input style={inputStyle} type="number" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" />
            </div>
            <div>
              <label style={labelStyle}>Currency</label>
              <select style={inputStyle} value={form.currency} onChange={e => set('currency', e.target.value)}>
                <option>NGN</option><option>USD</option><option>GBP</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose}
              style={{ padding: '8px 18px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: '1px solid var(--color-border)', background: 'transparent',
                color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
              Cancel
            </button>
            <button type="submit" disabled={create.isPending}
              style={{ padding: '8px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: 'none', background: '#0ea5e9', color: 'white', fontFamily: 'var(--font-body)',
                opacity: create.isPending ? 0.6 : 1 }}>
              {create.isPending ? 'Creating…' : 'Create Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function CustomersPage() {
  const navigate = useNavigate();
  const toast    = useToast();

  const [status,     setStatus]     = useState('');
  const [sourceApp,  setSourceApp]  = useState('');
  const [page,       setPage]       = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [exporting,  setExporting]  = useState(false);

  const PAGE_SIZE = 50;

  const { data, isLoading } = useCustomers({
    status:    status    || undefined,
    source_app: sourceApp || undefined,
    page,
    page_size:  PAGE_SIZE,
  });

  const customers: any[] = (data as any)?.data ?? [];
  const hasMore = customers.length === PAGE_SIZE;

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await customersApi.exportCsv({ status: status || undefined, source_app: sourceApp || undefined });
      const url = URL.createObjectURL(res.data as Blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = 'customers.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ overflow: 'auto', flex: 1, background: 'var(--color-surface)' }}>
      <div style={{ padding: '28px', maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-.02em' }}>
              Customers
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
              Manage customer profiles and onboarding pipeline
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleExport} disabled={exporting}
              style={{ padding: '7px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: '1px solid var(--color-border)', background: 'var(--color-surface-2)',
                color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
              {exporting ? 'Exporting…' : '↓ Export CSV'}
            </button>
            <button onClick={() => setShowCreate(true)}
              style={{ padding: '7px 16px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: 'none', background: '#0ea5e9', color: 'white', fontFamily: 'var(--font-body)' }}>
              + New Customer
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {[
            { label: 'All Statuses', value: '' },
            { label: 'Pending',      value: 'pending' },
            { label: 'Active',       value: 'active' },
            { label: 'Suspended',    value: 'suspended' },
            { label: 'Churned',      value: 'churned' },
          ].map(opt => (
            <button key={opt.value} onClick={() => { setStatus(opt.value); setPage(1); }}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-body)',
                background: status === opt.value ? '#0ea5e9' : 'var(--color-surface-2)',
                color:      status === opt.value ? 'white'   : 'var(--color-text-muted)',
                border:     status === opt.value ? 'none'    : '1px solid var(--color-border)',
              }}>
              {opt.label}
            </button>
          ))}
          <select value={sourceApp} onChange={e => { setSourceApp(e.target.value); setPage(1); }}
            style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
              border: '1px solid var(--color-border)', background: 'var(--color-surface)',
              color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
            <option value="">All Sources</option>
            {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
            Loading customers…
          </div>
        ) : customers.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>👥</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>No customers found</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
              Adjust filters or add a new customer
            </div>
          </div>
        ) : (
          <div style={{ background: 'white', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-2)' }}>
                  {['Customer', 'Contact', 'Status', 'Source', 'Created'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 700,
                      color: 'var(--color-text-muted)', textTransform: 'uppercase',
                      letterSpacing: '.06em', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map((c: any, i: number) => (
                  <tr key={c.id}
                    onClick={() => navigate(`/customers/${c.id}`)}
                    style={{ cursor: 'pointer', background: i % 2 === 0 ? 'white' : 'var(--color-surface)',
                      transition: 'background .12s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(14,165,233,.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'white' : 'var(--color-surface)')}
                  >
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--color-border)' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {c.fullName ?? `${c.firstName} ${c.lastName}`}
                      </div>
                      {c.externalRefId && (
                        <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Ref: {c.externalRefId}</div>
                      )}
                    </td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--color-border)' }}>
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{c.email ?? '—'}</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{c.phone ?? ''}</div>
                    </td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--color-border)' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700,
                        background: `${STATUS_COLOR[c.status] ?? '#94a3b8'}18`,
                        color: STATUS_COLOR[c.status] ?? '#94a3b8',
                      }}>
                        {c.status?.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--color-border)' }}>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        {SOURCE_LABELS[c.sourceApp] ?? c.sourceApp}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--color-border)' }}>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && (hasMore || page > 1) && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                color: page === 1 ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                cursor: page === 1 ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)' }}>
              ← Prev
            </button>
            <span style={{ padding: '6px 12px', fontSize: 12, color: 'var(--color-text-muted)' }}>
              Page {page}
            </span>
            <button disabled={!hasMore} onClick={() => setPage(p => p + 1)}
              style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                color: !hasMore ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                cursor: !hasMore ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)' }}>
              Next →
            </button>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateCustomerModal
          onClose={() => setShowCreate(false)}
          onCreated={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
