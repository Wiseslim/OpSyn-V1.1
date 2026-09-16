// ============================================================
// OPSYN — InfrastructurePage  (Stage 4 redesign)
// Light theme · DataTable · Badge · Button · Modal
// Tabs: Sites · Nodes · Routes · GIS Map
// ============================================================

import { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { infrastructureApi } from '../../api/index';
import { useUIStore } from '../../store/ui.store';
import {
  Button, Badge, Modal, Input, Select, Textarea, DataTable,
  type Column,
} from '../../components/ui';
import { formBuilderApi, type ContextSchema } from '../../api/form-builder.api';
import FormRenderer from '../../components/form-builder/FormRenderer';
import type { ApiError } from '../../api/client';

const InfraMapView = lazy(() => import('./InfraMapView'));

const toArr = (d: any): any[] => Array.isArray(d) ? d : (d?.items ?? []);

function useToast() {
  const { addToast } = useUIStore();
  return {
    success: (title: string, message?: string) => addToast({ type: 'success', title, message }),
    error:   (title: string, message?: string) => addToast({ type: 'error',   title, message }),
    info:    (title: string, message?: string) => addToast({ type: 'info',    title, message }),
  };
}

type TabKey = 'sites' | 'nodes' | 'routes' | 'olts' | 'cabinets' | 'splitters' | 'map';

const statusVariant = (s: string) =>
  s === 'active' ? 'resolved' : s === 'maintenance' ? 'warning' : 'critical';

const SITE_TYPE_OPTIONS = [
  { label: 'POP',         value: 'POP' },
  { label: 'Exchange',    value: 'exchange' },
  { label: 'Cabinet',     value: 'cabinet' },
  { label: 'Data Centre', value: 'data_centre' },
];
const NODE_TYPE_OPTIONS = [
  { label: 'OLT',             value: 'OLT' },
  { label: 'Aggregation Switch', value: 'AGG' },
  { label: 'Core Router',     value: 'CORE' },
  { label: 'Access Switch',   value: 'ACCESS' },
];
const CABLE_TYPE_OPTIONS = [
  { label: 'Single-mode Fiber',    value: 'SMF' },
  { label: 'Multi-mode Fiber',     value: 'MMF' },
  { label: 'Aerial ADSS',          value: 'ADSS' },
  { label: 'Armoured Underground', value: 'ARMOURED' },
];
const STATUS_OPTIONS = [
  { label: 'Active',          value: 'active' },
  { label: 'Maintenance',     value: 'maintenance' },
  { label: 'Decommissioned',  value: 'decommissioned' },
];
const ROUTE_STATUS_OPTIONS = [
  { label: 'Active',      value: 'active' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Inactive',    value: 'inactive' },
];
const NODE_STATUS_OPTIONS = [
  { label: 'Active',      value: 'active' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Offline',     value: 'offline' },
];

// ── InfraFormsModal — Form Builder integration (Phase 8) ─────

function InfraFormsModal({
  itemId,
  itemName,
  onClose,
}: {
  itemId:   string;
  itemName: string;
  onClose:  () => void;
}) {
  const [activeIdx, setActiveIdx] = useState(0);

  const contextQ = useQuery({
    queryKey: ['form-builder', 'context', 'module', itemId],
    queryFn:  () => formBuilderApi.getContextSchemas('module', itemId),
    staleTime: 60_000,
  });

  const schemas: ContextSchema[] = contextQ.data ?? [];

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.50)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 60, paddingBottom: 40, overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 680,
          margin: '0 24px',
          background: 'var(--color-surface)',
          borderRadius: 12, border: '1px solid var(--color-border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.30)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '14px 18px', borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 14, fontWeight: 700,
              fontFamily: 'var(--font-display)', color: 'var(--chalk1)',
            }}>
              Forms — {itemName}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', fontFamily: 'var(--font-display)' }}>
              Dynamic forms associated with this infrastructure item
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.40)', fontSize: 22, lineHeight: 1, padding: 4,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {contextQ.isLoading && (
            <div style={{
              textAlign: 'center', padding: '32px 0',
              fontSize: 12, color: 'rgba(255,255,255,0.30)', fontFamily: 'var(--font-display)',
            }}>
              Loading associated forms…
            </div>
          )}

          {!contextQ.isLoading && schemas.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '40px 0',
              fontSize: 12, color: 'rgba(255,255,255,0.30)', fontFamily: 'var(--font-display)',
            }}>
              No forms are associated with this item.
              <br />
              <span style={{ fontSize: 11, opacity: 0.7 }}>
                Use the Form Builder to create associations for the infrastructure module.
              </span>
            </div>
          )}

          {!contextQ.isLoading && schemas.length > 0 && (
            <>
              {schemas.length > 1 && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                  {schemas.map((cs, i) => (
                    <button
                      key={cs.association.id}
                      onClick={() => setActiveIdx(i)}
                      style={{
                        padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        border:      activeIdx === i ? 'none' : '1px solid var(--color-border)',
                        background:  activeIdx === i ? 'var(--color-teal)' : 'transparent',
                        color:       activeIdx === i ? 'var(--color-navy)' : 'rgba(255,255,255,0.55)',
                        cursor: 'pointer', fontFamily: 'var(--font-display)',
                      }}
                    >
                      {cs.schema.name}
                      {cs.schema.is_mandatory && (
                        <span style={{ color: activeIdx === i ? 'var(--color-navy)' : '#ff5a5a', marginLeft: 3 }}>*</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {(() => {
                const active = schemas[activeIdx] ?? schemas[0];
                return (
                  <FormRenderer
                    schemaId={active.schema.id}
                    entityType="module"
                    entityId={itemId}
                    associationId={active.association.id}
                  />
                );
              })()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InfrastructurePage() {
  const [tab, setTab]               = useState<TabKey>('sites');
  const [search, setSearch]         = useState('');
  const [siteModal, setSiteModal]   = useState(false);
  const [nodeModal, setNodeModal]   = useState(false);
  const [routeModal, setRouteModal] = useState(false);
  const [infraFormsItem, setInfraFormsItem] = useState<{ id: string; name: string } | null>(null);
  const toast    = useToast();
  const qc       = useQueryClient();
  const navigate = useNavigate();

  const [siteForm, setSiteForm]   = useState({ name: '', site_type: 'POP', address: '', status: 'active', notes: '' });
  const [nodeForm, setNodeForm]   = useState({ name: '', node_type: 'OLT', site_id: '', manufacturer: '', model: '', ip_address: '', status: 'active' });
  const [routeForm, setRouteForm] = useState({ from_node_id: '', to_node_id: '', cable_type: '', length_km: '', capacity_gbps: '', status: 'active' });

  const { data: summary }                            = useQuery({ queryKey: ['infra', 'summary'], queryFn: () => infrastructureApi.getSummary(), refetchInterval: 60000 });
  const { data: sitesData,    isLoading: sitesLoading    } = useQuery({ queryKey: ['infra', 'sites'],    queryFn: () => infrastructureApi.listSites({ size: 200 }) });
  const { data: nodesData,    isLoading: nodesLoading    } = useQuery({ queryKey: ['infra', 'nodes'],    queryFn: () => infrastructureApi.listNodes({ size: 200 }) });
  const { data: routesData,   isLoading: routesLoading   } = useQuery({ queryKey: ['infra', 'routes'],   queryFn: () => infrastructureApi.listRoutes({ size: 200 }) });
  const { data: oltsData,     isLoading: oltsLoading     } = useQuery({ queryKey: ['infra', 'olts'],     queryFn: () => infrastructureApi.listOlts({ size: 200 }) });
  const { data: cabinetsData, isLoading: cabinetsLoading } = useQuery({ queryKey: ['infra', 'cabinets'], queryFn: () => infrastructureApi.listCabinets({ size: 200 }) });
  const { data: splittersData, isLoading: splittersLoading } = useQuery({ queryKey: ['infra', 'splitters'], queryFn: () => infrastructureApi.listSplitters({ size: 200 }) });

  const sites    = toArr((sitesData    as any)?.items ?? sitesData);
  const nodes    = toArr((nodesData    as any)?.items ?? nodesData);
  const routes   = toArr((routesData   as any)?.items ?? routesData);
  const olts     = toArr((oltsData     as any)?.items ?? oltsData);
  const cabinets = toArr((cabinetsData as any)?.items ?? cabinetsData);
  const splitters = toArr((splittersData as any)?.items ?? splittersData);

  const nodeOptions = nodes.map((n: any) => ({ label: `${n.name} (${n.node_type})`, value: n.id }));
  const siteOptions = sites.map((s: any) => ({ label: s.name, value: s.id }));

  // ── Search filtering ─────────────────────────────────────────
  const q = search.trim().toLowerCase();

  const matchCoord = (lat: any, lng: any): boolean => {
    if (!q || lat == null || lng == null) return false;
    return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`.includes(q);
  };
  const anyOf = (...vals: any[]) => vals.some(v => v != null && String(v).toLowerCase().includes(q));

  const sitesFiltered    = !q ? sites    : sites.filter((r: any)    => anyOf(r.name, r.id, r.address));
  const nodesFiltered    = !q ? nodes    : nodes.filter((r: any)    => anyOf(r.name, r.id, r.ip_address, r.manufacturer, r.model));
  const routesFiltered   = !q ? routes   : routes.filter((r: any)   => {
    const fn = nodes.find((n: any) => n.id === r.from_node_id);
    const tn = nodes.find((n: any) => n.id === r.to_node_id);
    return anyOf(r.id, r.cable_type, fn?.name, tn?.name);
  });
  const oltsFiltered     = !q ? olts     : olts.filter((r: any)     => anyOf(r.name, r.id, r.location_description) || matchCoord(r.latitude, r.longitude));
  const cabinetsFiltered = !q ? cabinets : cabinets.filter((r: any) => anyOf(r.cabinet_id, r.id)                   || matchCoord(r.latitude, r.longitude));
  const splittersFiltered = !q ? splitters : splitters.filter((r: any) => anyOf(r.box_id, r.id, r.splitter_level, r.splitter_type) || matchCoord(r.latitude, r.longitude));

  const createSite = useMutation({
    mutationFn: () => infrastructureApi.createSite(siteForm as any),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['infra'] }); setSiteModal(false); setSiteForm({ name: '', site_type: 'POP', address: '', status: 'active', notes: '' }); toast.success('Site created'); },
    onError: (e: ApiError) => toast.error('Failed', e?.detail),
  });
  const createNode = useMutation({
    mutationFn: () => infrastructureApi.createNode(nodeForm as any),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['infra'] }); setNodeModal(false); setNodeForm({ name: '', node_type: 'OLT', site_id: '', manufacturer: '', model: '', ip_address: '', status: 'active' }); toast.success('Node created'); },
    onError: (e: ApiError) => toast.error('Failed', e?.detail),
  });
  const createRoute = useMutation({
    mutationFn: () => infrastructureApi.createRoute({
      ...routeForm,
      length_km:     routeForm.length_km     ? parseFloat(routeForm.length_km)     : undefined,
      capacity_gbps: routeForm.capacity_gbps ? parseFloat(routeForm.capacity_gbps) : undefined,
    } as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['infra'] }); setRouteModal(false); setRouteForm({ from_node_id: '', to_node_id: '', cable_type: '', length_km: '', capacity_gbps: '', status: 'active' }); toast.success('Route created'); },
    onError: (e: ApiError) => toast.error('Failed', e?.detail),
  });
  const deleteRoute = useMutation({
    mutationFn: (id: string) => infrastructureApi.deleteRoute(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['infra'] }); toast.info('Route removed'); },
    onError: (e: ApiError) => toast.error('Failed', e?.detail),
  });

  const summ = summary as any;

  // ── Column definitions ───────────────────────────────────────
  const siteColumns: Column[] = [
    {
      key: 'name', header: 'Name', sortable: true,
      render: (_v: any, row: any) => (
        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: 12 }}>{row.name}</span>
      ),
    },
    {
      key: 'site_type', header: 'Type', width: 110,
      render: (_v: any, row: any) => <Badge variant="info" size="sm">{row.site_type}</Badge>,
    },
    {
      key: 'address', header: 'Address',
      render: (_v: any, row: any) => (
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{row.address ?? '—'}</span>
      ),
    },
    {
      key: 'status', header: 'Status', width: 110,
      render: (_v: any, row: any) => (
        <Badge variant={statusVariant(row.status)} size="sm">{row.status}</Badge>
      ),
    },
    {
      key: 'created_at', header: 'Created', width: 130,
      render: (_v: any, row: any) => (
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          {new Date(row.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
  ];

  const nodeTypeVariant = (t: string) => t === 'OLT' ? 'info' : t === 'AGG' ? 'teal' : 'warning';

  const nodeColumns: Column[] = [
    {
      key: 'name', header: 'Name', sortable: true,
      render: (_v: any, row: any) => (
        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: 12 }}>{row.name}</span>
      ),
    },
    {
      key: 'node_type', header: 'Type', width: 100,
      render: (_v: any, row: any) => <Badge variant={nodeTypeVariant(row.node_type)} size="sm">{row.node_type}</Badge>,
    },
    {
      key: 'ip_address', header: 'IP Address', width: 140,
      render: (_v: any, row: any) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-teal)' }}>
          {row.ip_address ?? '—'}
        </span>
      ),
    },
    {
      key: 'manufacturer', header: 'Manufacturer', width: 130,
      render: (_v: any, row: any) => <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{row.manufacturer ?? '—'}</span>,
    },
    {
      key: 'model', header: 'Model', width: 120,
      render: (_v: any, row: any) => <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{row.model ?? '—'}</span>,
    },
    {
      key: 'status', header: 'Status', width: 110,
      render: (_v: any, row: any) => <Badge variant={statusVariant(row.status)} size="sm">{row.status}</Badge>,
    },
  ];

  const coordCell = (lat: any, lng: any) => (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-muted)' }}>
      {lat != null ? Number(lat).toFixed(5) : '—'}, {lng != null ? Number(lng).toFixed(5) : '—'}
    </span>
  );

  const uploadedAt = (iso: string) => (
    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
      {new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
    </span>
  );

  const oltColumns: Column[] = [
    {
      key: 'name', header: 'Name', sortable: true,
      render: (_v: any, row: any) => (
        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: 12 }}>{row.name}</span>
      ),
    },
    {
      key: 'location_description', header: 'Location',
      render: (_v: any, row: any) => (
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{row.location_description ?? '—'}</span>
      ),
    },
    {
      key: 'number_of_odf', header: 'ODF Ports', width: 100, align: 'right',
      render: (_v: any, row: any) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{row.number_of_odf ?? '—'}</span>
      ),
    },
    {
      key: 'latitude', header: 'Coordinates', width: 180,
      render: (_v: any, row: any) => coordCell(row.latitude, row.longitude),
    },
    {
      key: 'created_at', header: 'Uploaded', width: 130,
      render: (_v: any, row: any) => uploadedAt(row.created_at),
    },
  ];

  const cabinetColumns: Column[] = [
    {
      key: 'cabinet_id', header: 'Cabinet ID', sortable: true,
      render: (_v: any, row: any) => (
        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: 12 }}>{row.cabinet_id}</span>
      ),
    },
    {
      key: 'capacity', header: 'Capacity', width: 100, align: 'right',
      render: (_v: any, row: any) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{row.capacity ?? '—'}</span>
      ),
    },
    {
      key: 'number_tray', header: 'Trays', width: 90, align: 'right',
      render: (_v: any, row: any) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{row.number_tray ?? '—'}</span>
      ),
    },
    {
      key: 'latitude', header: 'Coordinates', width: 180,
      render: (_v: any, row: any) => coordCell(row.latitude, row.longitude),
    },
    {
      key: 'created_at', header: 'Uploaded', width: 130,
      render: (_v: any, row: any) => uploadedAt(row.created_at),
    },
  ];

  const levelVariant = (l: string) => l === 'First-Level' ? 'info' : 'teal';
  const typeVariant  = (t: string) => t === 'PCC'         ? 'info' : 'warning';

  const splitterColumns: Column[] = [
    {
      key: 'box_id', header: 'Box ID', sortable: true,
      render: (_v: any, row: any) => (
        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: 12 }}>{row.box_id}</span>
      ),
    },
    {
      key: 'splitter_level', header: 'Level', width: 130,
      render: (_v: any, row: any) => (
        <Badge variant={levelVariant(row.splitter_level)} size="sm">{row.splitter_level}</Badge>
      ),
    },
    {
      key: 'splitter_type', header: 'Type', width: 90,
      render: (_v: any, row: any) => (
        <Badge variant={typeVariant(row.splitter_type)} size="sm">{row.splitter_type}</Badge>
      ),
    },
    {
      key: 'input_ports', header: 'Ports (in:out)', width: 120, align: 'right',
      render: (_v: any, row: any) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{row.input_ports}:{row.output_ports}</span>
      ),
    },
    {
      key: 'number_customer', header: 'Customers', width: 100, align: 'right',
      render: (_v: any, row: any) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{row.number_customer ?? 0}</span>
      ),
    },
    {
      key: 'latitude', header: 'Coordinates', width: 180,
      render: (_v: any, row: any) => coordCell(row.latitude, row.longitude),
    },
    {
      key: 'created_at', header: 'Uploaded', width: 130,
      render: (_v: any, row: any) => uploadedAt(row.created_at),
    },
  ];

  const routeColumns: Column[] = [
    {
      key: 'from_node_id', header: 'From Node',
      render: (_v: any, row: any) => {
        const fn = nodes.find((n: any) => n.id === row.from_node_id);
        return <span style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>{fn?.name ?? row.from_node_id?.slice(0, 8) + '…'}</span>;
      },
    },
    {
      key: 'to_node_id', header: 'To Node',
      render: (_v: any, row: any) => {
        const tn = nodes.find((n: any) => n.id === row.to_node_id);
        return <span style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>{tn?.name ?? row.to_node_id?.slice(0, 8) + '…'}</span>;
      },
    },
    {
      key: 'cable_type', header: 'Cable Type', width: 130,
      render: (_v: any, row: any) => <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{row.cable_type ?? '—'}</span>,
    },
    {
      key: 'length_km', header: 'Length (km)', width: 110, align: 'right',
      render: (_v: any, row: any) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          {row.length_km != null ? Number(row.length_km).toFixed(2) : '—'}
        </span>
      ),
    },
    {
      key: 'capacity_gbps', header: 'Capacity (Gbps)', width: 130, align: 'right',
      render: (_v: any, row: any) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          {row.capacity_gbps != null ? Number(row.capacity_gbps).toFixed(1) : '—'}
        </span>
      ),
    },
    {
      key: 'status', header: 'Status', width: 110,
      render: (_v: any, row: any) => <Badge variant={statusVariant(row.status)} size="sm">{row.status}</Badge>,
    },
    {
      key: 'id', header: 'Actions', width: 100,
      render: (_v: any, row: any) => (
        <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <Button variant="danger" size="xs"
            onClick={() => deleteRoute.mutate(row.id)}
            disabled={deleteRoute.isPending}
          >
            Remove
          </Button>
        </div>
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
        flexWrap:     'wrap',
      }}>
        {[
          { val: summ?.active_sites  ?? '…', label: 'Active Sites',   color: 'var(--color-teal)' },
          { val: summ?.active_nodes  ?? '…', label: 'Active Nodes',   color: 'var(--color-green)' },
          { val: summ?.olt_count     ?? '…', label: 'OLTs',           color: 'var(--color-indigo)' },
          { val: summ?.active_routes ?? '…', label: 'Active Routes',  color: 'var(--color-amber)' },
          {
            val:   summ?.total_fiber_km != null ? `${Number(summ.total_fiber_km).toFixed(1)} km` : '…',
            label: 'Total Fiber',
            color: 'var(--color-text-primary)',
          },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: item.color }}>
              {item.val}
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>{item.label}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: '20px 24px' }}>

        {/* Page header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800,
              color: 'var(--color-text-primary)', letterSpacing: '-.03em', margin: 0,
            }}>
              Network Infrastructure
            </h1>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0 }}>
              FTTx asset registry · sites, nodes &amp; fiber routes
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" size="sm" onClick={() => navigate('/infrastructure/upload')}>⬆ Bulk Upload</Button>
            <Button variant="danger"    size="sm" onClick={() => navigate('/infrastructure/deletion')}>⬇ Bulk Delete</Button>
            <Button variant="ghost"     size="sm" onClick={() => navigate('/infrastructure/audit')}>Audit Log</Button>
            {tab === 'sites'  && <Button variant="primary" size="sm" onClick={() => setSiteModal(true)}>+ Add Site</Button>}
            {tab === 'nodes'  && <Button variant="primary" size="sm" onClick={() => setNodeModal(true)}>+ Add Node</Button>}
            {tab === 'routes' && <Button variant="primary" size="sm" onClick={() => setRouteModal(true)}>+ Add Route</Button>}
          </div>
        </div>

        {/* Tab bar + search row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
          <div style={{
            display:      'flex',
            gap:          2,
            background:   'white',
            borderRadius: 'var(--radius-card)',
            padding:      3,
            border:       '1px solid var(--color-border)',
          }}>
            {(['sites', 'nodes', 'routes', 'olts', 'cabinets', 'splitters', 'map'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding:      '6px 16px',
                  borderRadius: 8,
                  border:       'none',
                  cursor:       'pointer',
                  fontFamily:   'var(--font-display)',
                  fontSize:     12,
                  fontWeight:   600,
                  transition:   'all .15s',
                  background:   tab === t ? 'var(--color-teal)' : 'transparent',
                  color:        tab === t ? 'var(--color-navy)' : 'var(--color-text-muted)',
                }}
              >
                {t === 'map' ? 'GIS Map' : t === 'olts' ? 'OLTs' : t === 'cabinets' ? 'Cabinets' : t === 'splitters' ? 'Splitters' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {tab !== 'map' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--color-text-muted)', fontSize: 13, pointerEvents: 'none', lineHeight: 1,
                }}>⌕</span>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, ID or coordinates…"
                  style={{
                    paddingLeft:   30,
                    paddingRight:  search ? 30 : 12,
                    paddingTop:    7,
                    paddingBottom: 7,
                    width:         280,
                    border:        '1px solid var(--color-border)',
                    borderRadius:  'var(--radius-card)',
                    fontFamily:    'var(--font-body)',
                    fontSize:      12,
                    color:         'var(--color-text-primary)',
                    background:    'white',
                    outline:       'none',
                  }}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    style={{
                      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1, padding: 0,
                    }}
                    aria-label="Clear search"
                  >×</button>
                )}
              </div>
              {search && (
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                  {tab === 'sites'    ? sitesFiltered.length
                   : tab === 'nodes'  ? nodesFiltered.length
                   : tab === 'routes' ? routesFiltered.length
                   : tab === 'olts'   ? oltsFiltered.length
                   : tab === 'cabinets' ? cabinetsFiltered.length
                   : splittersFiltered.length} result{(
                     tab === 'sites' ? sitesFiltered.length : tab === 'nodes' ? nodesFiltered.length :
                     tab === 'routes' ? routesFiltered.length : tab === 'olts' ? oltsFiltered.length :
                     tab === 'cabinets' ? cabinetsFiltered.length : splittersFiltered.length
                   ) !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Sites table */}
        {tab === 'sites' && (
          <DataTable
            columns={siteColumns}
            data={sitesFiltered}
            rowKey={(row: any) => row.id}
            isLoading={sitesLoading}
            emptyTitle={search ? 'No sites match your search' : 'No sites registered'}
            emptyMessage={search ? 'Try a different name or ID.' : 'Add your first network site to get started.'}
            onRowClick={(row: any) => setInfraFormsItem({ id: row.id, name: row.name })}
          />
        )}

        {/* Nodes table */}
        {tab === 'nodes' && (
          <DataTable
            columns={nodeColumns}
            data={nodesFiltered}
            rowKey={(row: any) => row.id}
            isLoading={nodesLoading}
            emptyTitle={search ? 'No nodes match your search' : 'No nodes registered'}
            emptyMessage={search ? 'Try a different name, IP or ID.' : 'Add your first network node to get started.'}
            onRowClick={(row: any) => setInfraFormsItem({ id: row.id, name: row.name })}
          />
        )}

        {/* Routes table */}
        {tab === 'routes' && (
          <DataTable
            columns={routeColumns}
            data={routesFiltered}
            rowKey={(row: any) => row.id}
            isLoading={routesLoading}
            emptyTitle={search ? 'No routes match your search' : 'No fiber routes registered'}
            emptyMessage={search ? 'Try a node name or cable type.' : 'Add a fiber route between nodes.'}
          />
        )}

        {/* OLTs table */}
        {tab === 'olts' && (
          <DataTable
            columns={oltColumns}
            data={oltsFiltered}
            rowKey={(row: any) => row.id}
            isLoading={oltsLoading}
            emptyTitle={search ? 'No OLTs match your search' : 'No OLTs uploaded'}
            emptyMessage={search ? 'Try the OLT name, ID or coordinates.' : 'Use Bulk Upload to add OLT assets.'}
          />
        )}

        {/* Cabinets table */}
        {tab === 'cabinets' && (
          <DataTable
            columns={cabinetColumns}
            data={cabinetsFiltered}
            rowKey={(row: any) => row.id}
            isLoading={cabinetsLoading}
            emptyTitle={search ? 'No cabinets match your search' : 'No cabinets uploaded'}
            emptyMessage={search ? 'Try the cabinet ID or coordinates.' : 'Use Bulk Upload to add cabinet assets.'}
          />
        )}

        {/* Splitters table */}
        {tab === 'splitters' && (
          <DataTable
            columns={splitterColumns}
            data={splittersFiltered}
            rowKey={(row: any) => row.id}
            isLoading={splittersLoading}
            emptyTitle={search ? 'No splitter boxes match your search' : 'No splitter boxes uploaded'}
            emptyMessage={search ? 'Try the box ID, type or coordinates.' : 'Use Bulk Upload to add splitter assets.'}
          />
        )}

        {/* Map */}
        {tab === 'map' && (
          <div style={{ marginLeft: -24, marginRight: -24, marginBottom: -20, height: 'calc(100vh - 220px)', minHeight: 500 }}>
            <Suspense fallback={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)', fontSize: 13 }}>
                Loading map…
              </div>
            }>
              <InfraMapView />
            </Suspense>
          </div>
        )}
      </div>

      {/* Register Site Modal */}
      <Modal
        open={siteModal}
        onClose={() => setSiteModal(false)}
        title="Register New Site"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSiteModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => createSite.mutate()} disabled={!siteForm.name || createSite.isPending} loading={createSite.isPending}>
              Register Site
            </Button>
          </>
        }
      >
        <Input label="Site Name" required value={siteForm.name} onChange={v => setSiteForm(f => ({ ...f, name: v }))} placeholder="e.g. Lagos Island POP" />
        <Select label="Site Type" value={siteForm.site_type} onChange={v => setSiteForm(f => ({ ...f, site_type: v }))} options={SITE_TYPE_OPTIONS} />
        <Input label="Address" value={siteForm.address} onChange={v => setSiteForm(f => ({ ...f, address: v }))} placeholder="Physical address" />
        <Select label="Status" value={siteForm.status} onChange={v => setSiteForm(f => ({ ...f, status: v }))} options={STATUS_OPTIONS} />
        <Textarea label="Notes" value={siteForm.notes} onChange={v => setSiteForm(f => ({ ...f, notes: v }))} placeholder="Optional notes…" rows={2} />
      </Modal>

      {/* Register Node Modal */}
      <Modal
        open={nodeModal}
        onClose={() => setNodeModal(false)}
        title="Register New Node"
        footer={
          <>
            <Button variant="secondary" onClick={() => setNodeModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => createNode.mutate()} disabled={!nodeForm.name || createNode.isPending} loading={createNode.isPending}>
              Register Node
            </Button>
          </>
        }
      >
        <Input label="Node Name" required value={nodeForm.name} onChange={v => setNodeForm(f => ({ ...f, name: v }))} placeholder="e.g. OLT-Lagos-024" />
        <Select label="Node Type" value={nodeForm.node_type} onChange={v => setNodeForm(f => ({ ...f, node_type: v }))} options={NODE_TYPE_OPTIONS} />
        <Select label="Site" value={nodeForm.site_id} onChange={v => setNodeForm(f => ({ ...f, site_id: v }))} options={siteOptions} />
        <Input label="IP Address" value={nodeForm.ip_address} onChange={v => setNodeForm(f => ({ ...f, ip_address: v }))} placeholder="e.g. 10.0.1.1" />
        <Input label="Manufacturer" value={nodeForm.manufacturer} onChange={v => setNodeForm(f => ({ ...f, manufacturer: v }))} placeholder="e.g. Huawei" />
        <Input label="Model" value={nodeForm.model} onChange={v => setNodeForm(f => ({ ...f, model: v }))} placeholder="e.g. MA5800-X15" />
        <Select label="Status" value={nodeForm.status} onChange={v => setNodeForm(f => ({ ...f, status: v }))} options={NODE_STATUS_OPTIONS} />
      </Modal>

      {/* Register Route Modal */}
      <Modal
        open={routeModal}
        onClose={() => setRouteModal(false)}
        title="Register Fiber Route"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRouteModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => createRoute.mutate()} disabled={!routeForm.from_node_id || !routeForm.to_node_id || createRoute.isPending} loading={createRoute.isPending}>
              Register Route
            </Button>
          </>
        }
      >
        <Select label="From Node" required value={routeForm.from_node_id} onChange={v => setRouteForm(f => ({ ...f, from_node_id: v }))} options={nodeOptions} />
        <Select label="To Node" required value={routeForm.to_node_id} onChange={v => setRouteForm(f => ({ ...f, to_node_id: v }))} options={nodeOptions} />
        <Select label="Cable Type" value={routeForm.cable_type} onChange={v => setRouteForm(f => ({ ...f, cable_type: v }))} options={CABLE_TYPE_OPTIONS} />
        <Input label="Length (km)" value={routeForm.length_km} onChange={v => setRouteForm(f => ({ ...f, length_km: v }))} type="number" placeholder="e.g. 12.5" />
        <Input label="Capacity (Gbps)" value={routeForm.capacity_gbps} onChange={v => setRouteForm(f => ({ ...f, capacity_gbps: v }))} type="number" placeholder="e.g. 100" />
        <Select label="Status" value={routeForm.status} onChange={v => setRouteForm(f => ({ ...f, status: v }))} options={ROUTE_STATUS_OPTIONS} />
      </Modal>

      {/* Infrastructure Forms Modal — triggered by row click on Sites/Nodes */}
      {infraFormsItem && (
        <InfraFormsModal
          itemId={infraFormsItem.id}
          itemName={infraFormsItem.name}
          onClose={() => setInfraFormsItem(null)}
        />
      )}
    </div>
  );
}
