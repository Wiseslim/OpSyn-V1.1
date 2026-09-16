// ============================================================
// OPSYN — OutagePage  (Stage 4 redesign)
// Light theme · DataTable · Badge · Button · Modal
// Fixes pre-existing bug: navigate was used but never declared
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { outageApi } from '../../api/index';
import { useUIStore } from '../../store/ui.store';
import {
  Button, Badge, Modal, Input, Select, Textarea, DataTable,
  type Column,
} from '../../components/ui';

function useToast() {
  const { addToast } = useUIStore();
  return {
    success: (title: string, message?: string) => addToast({ type: 'success', title, message }),
    error:   (title: string, message?: string) => addToast({ type: 'error',   title, message }),
    info:    (title: string, message?: string) => addToast({ type: 'info',    title, message }),
  };
}

function SlaChip({ o }: { o: any }) {
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('var(--color-text-muted)');

  useEffect(() => {
    if (!o.sla_deadline) return;
    function update() {
      if (o.breached_sla) { setLabel('BREACHED'); setColor('var(--color-red)'); return; }
      const diff = Math.floor((new Date(o.sla_deadline).getTime() - Date.now()) / 60000);
      if (diff <= 0)       { setLabel('Expired');                            setColor('var(--color-red)'); }
      else if (diff < 30)  { setLabel(`${diff}m`);                           setColor('var(--color-red)'); }
      else if (diff < 60)  { setLabel(`${diff}m`);                           setColor('var(--color-amber)'); }
      else                 { setLabel(`${Math.floor(diff/60)}h ${diff%60}m`); setColor('var(--color-green)'); }
    }
    update();
    const t = setInterval(update, 30000);
    return () => clearInterval(t);
  }, [o.sla_deadline, o.breached_sla]);

  if (!o.sla_deadline) return null;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

const SEVERITY_OPTIONS = [
  { label: 'Critical', value: 'critical' },
  { label: 'High',     value: 'high' },
  { label: 'Warning',  value: 'warning' },
  { label: 'Low',      value: 'low' },
];

export default function OutagePage() {
  const navigate = useNavigate();
  const toast    = useToast();
  const qc       = useQueryClient();
  const [logModal, setLogModal] = useState(false);
  const [form, setForm]         = useState({ title: '', severity: 'warning', description: '', olt_reference: '' });

  const { data, isLoading } = useQuery({
    queryKey:        ['outages'],
    queryFn:         () => outageApi.list(),
    refetchInterval: 30000,
  });

  const log = useMutation({
    mutationFn: () => outageApi.log(form as any),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['outages'] });
      setLogModal(false);
      setForm({ title: '', severity: 'warning', description: '', olt_reference: '' });
      toast.info('Outage logged');
    },
    onError: (e: any) => toast.error('Failed to log', e?.detail),
  });

  const resolve = useMutation({
    mutationFn: (id: string) => outageApi.resolve(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['outages'] }); toast.success('Outage resolved'); },
    onError: (e: any) => toast.error('Failed', e?.detail),
  });

  const setMonitoring = useMutation({
    mutationFn: (id: string) => outageApi.updateStatus(id, 'monitoring'),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['outages'] }); toast.info('Status set to Monitoring'); },
    onError: (e: any) => toast.error('Failed', e?.detail),
  });

  const items    = (data as any)?.items ?? [];
  const active   = items.filter((o: any) => o.status === 'active' || o.status === 'monitoring');
  const resolved = items.filter((o: any) => o.status === 'resolved');
  const set      = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const columns: Column[] = [
    {
      key: 'reference', header: 'Incident ID', width: 140,
      render: (_v: any, row: any) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-teal)' }}>
          {row.reference}
        </span>
      ),
    },
    {
      key: 'title', header: 'Title',
      render: (_v: any, row: any) => (
        <div>
          <div style={{ fontWeight: 500, color: 'var(--color-text-primary)', fontSize: 12 }}>{row.title}</div>
          {row.description && (
            <div style={{
              fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2,
              maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {row.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'severity', header: 'Severity', width: 100,
      render: (_v: any, row: any) => (
        <Badge variant={row.severity === 'critical' ? 'critical' : row.severity === 'high' ? 'high' : 'warning'} size="sm">
          {row.severity}
        </Badge>
      ),
    },
    {
      key: 'status', header: 'Status', width: 120,
      render: (_v: any, row: any) => (
        <Badge
          variant={row.status === 'active' ? 'critical' : row.status === 'resolved' ? 'resolved' : row.status === 'monitoring' ? 'warning' : 'info'}
          size="sm"
        >
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'sla_deadline', header: 'SLA', width: 90,
      render: (_v: any, row: any) => <SlaChip o={row} />,
    },
    {
      key: 'olt_reference', header: 'OLT Ref', width: 100,
      render: (_v: any, row: any) => (
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{row.olt_reference ?? '—'}</span>
      ),
    },
    {
      key: 'affected_subscribers', header: 'Subs', width: 70, align: 'right',
      render: (_v: any, row: any) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{row.affected_subscribers ?? 0}</span>
      ),
    },
    {
      key: 'created_at', header: 'Created', width: 140,
      render: (_v: any, row: any) => (
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          {new Date(row.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
      ),
    },
    {
      key: 'id', header: 'Actions', width: 150,
      render: (_v: any, row: any) => (
        row.status === 'resolved' ? (
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Resolved</span>
        ) : (
          <div style={{ display: 'flex', gap: 4 }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            {row.status === 'active' && (
              <Button variant="amber" size="xs"
                onClick={() => setMonitoring.mutate(row.id)}
                disabled={setMonitoring.isPending}
              >
                Monitor
              </Button>
            )}
            <Button variant="jade" size="xs"
              onClick={() => resolve.mutate(row.id)}
              disabled={resolve.isPending}
            >
              Resolve
            </Button>
          </div>
        )
      ),
    },
  ];

  return (
    <div style={{ overflow: 'auto', flex: 1, background: 'var(--color-surface)' }}>

      {/* Stat strip */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        background:   'white',
        borderBottom: '1px solid var(--color-border)',
        padding:      '8px 24px',
        fontSize:      11,
        gap:           28,
      }}>
        {[
          { val: String(active.length),   label: 'Active Incidents', color: 'var(--color-red)' },
          { val: String(resolved.length), label: 'Resolved Today',   color: 'var(--color-green)' },
          { val: String(items.length),    label: 'Total Incidents',   color: 'var(--color-text-primary)' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: item.color }}>
              {item.val}
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>{item.label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--color-text-muted)' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-green)', display: 'block' }} />
          Live · 30s refresh
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>

        {/* Page header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800,
              color: 'var(--color-text-primary)', letterSpacing: '-.03em', margin: 0,
            }}>
              Outage Monitor
            </h1>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0 }}>
              Real-time network incident command
            </p>
          </div>
          <Button variant="danger" size="sm" onClick={() => setLogModal(true)}>
            + Log Outage
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={items}
          rowKey={(row: any) => row.id}
          isLoading={isLoading}
          emptyTitle="No incidents recorded"
          emptyMessage="All systems are operational."
          onRowClick={(row: any) => navigate(`/outage/${row.id}`)}
          stickyHeader
        />
      </div>

      {/* Log Outage Modal */}
      <Modal
        open={logModal}
        onClose={() => setLogModal(false)}
        title="Log New Outage"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLogModal(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => log.mutate()}
              disabled={!form.title || log.isPending}
              loading={log.isPending}
            >
              Log Outage
            </Button>
          </>
        }
      >
        <Input
          label="Title"
          required
          value={form.title}
          onChange={v => set('title', v)}
          placeholder="e.g. Lagos Island · OLT-024 Fibre Cut"
        />
        <Select
          label="Severity"
          value={form.severity}
          onChange={v => set('severity', v)}
          options={SEVERITY_OPTIONS}
        />
        <Input
          label="OLT Reference"
          value={form.olt_reference}
          onChange={v => set('olt_reference', v)}
          placeholder="e.g. OLT-024"
        />
        <Textarea
          label="Description"
          value={form.description}
          onChange={v => set('description', v)}
          placeholder="Nature of the incident…"
          rows={3}
        />
      </Modal>
    </div>
  );
}
