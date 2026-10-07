import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { GeoJSONSource, LayerSpecification } from 'maplibre-gl';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Grip, Maximize2, Minimize2, Minus, X } from 'lucide-react';
import { fttxDesignerApi, type FttxDesignRunLayer, type FttxDesignRunResults, type FttxLayerKey } from '../../api/fttx-designer.api';
import { DataTable, Input, Pagination, type Column } from '../../components/ui';
import { useMapInstance } from './mapContext';
import { designError, geometryBounds } from './design/designFormat';
import s from './NetworkMap.module.css';

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const META: Record<string, { label: string; color: string; geometry: 'point' | 'line'; defaultOn?: boolean }> = {
  fdt:            { label: 'FDTs', color: '#7C3AED', geometry: 'point' },
  fat:            { label: 'FATs', color: '#16A34A', geometry: 'point' },
  closure:        { label: 'Closures', color: '#EA580C', geometry: 'point' },
  pole_output:    { label: 'Tagged poles', color: '#64748B', geometry: 'point' },
  pickup_point:   { label: 'Pickup points', color: '#0891B2', geometry: 'point' },
  b2b:            { label: 'Box-to-box cables', color: '#2563EB', geometry: 'line' },
  b2c:            { label: 'Drop cables', color: '#DB2777', geometry: 'line', defaultOn: false },
  feeder:         { label: 'Feeder cables', color: '#D97706', geometry: 'line' },
  closure_cable:  { label: 'Closure-to-FDT cables', color: '#0F766E', geometry: 'line' },
};

type Visibility = Record<string, boolean>;

function boundsOf(results: FttxDesignRunResults): [number, number, number, number] | null {
  const bounds: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const collection of Object.values(results.output_layers)) {
    for (const feature of collection.features ?? []) {
      const b = geometryBounds(feature.geometry as { coordinates: unknown } | null);
      if (!b) continue;
      bounds[0] = Math.min(bounds[0], b[0]); bounds[1] = Math.min(bounds[1], b[1]);
      bounds[2] = Math.max(bounds[2], b[2]); bounds[3] = Math.max(bounds[3], b[3]);
    }
  }
  return Number.isFinite(bounds[0]) ? bounds : null;
}

export function FttxRunPreviewPanel({ runId, results, error, inputLayers = [], visible, tableKey, onToggle, onOpenTable, onBack }: {
  runId: string; results?: FttxDesignRunResults; error?: unknown; visible: Visibility;
  inputLayers?: FttxDesignRunLayer[];
  tableKey: string | null; onToggle: (key: string, checked: boolean) => void;
  onOpenTable: (key: string) => void; onBack: () => void;
}) {
  const mapLayers = Object.keys(results?.output_layers ?? {});
  return (
    <aside className={s.panel} aria-label="FTTx design map layers">
      <div className={s.panelHead}>
        <div>
          <h1 className={s.title}>FTTx design preview</h1>
          <p className={s.summary}>Run {runId.slice(0, 8)}</p>
        </div>
      </div>
      <div style={{ padding: 16, overflowY: 'auto' }}>
        <button onClick={onBack} style={{ border: 0, padding: 0, marginBottom: 18, background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          ← Back to design results
        </button>
        {!results && <p className={s.summary}>{error ? designError(error, 'The design layers could not be loaded.') : 'Loading design layers…'}</p>}
        {inputLayers.length > 0 && (
          <>
            <h2 style={{ margin: '8px 0 4px', fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Uploaded input layers</h2>
            {inputLayers.map(layer => (
              <div key={layer.layer_key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', fontSize: 13 }}>
                <span style={{ width: 16, flex: 'none' }} />
                <span style={{ flex: 1 }}>{layer.layer_key[0].toUpperCase() + layer.layer_key.slice(1)}</span>
                <span className={s.summary}>{layer.feature_count ?? 0}</span>
                <button type="button" onClick={() => onOpenTable(layer.layer_key)} aria-label={`Open ${layer.layer_key} attribute table`}
                  aria-pressed={tableKey === layer.layer_key} title="Open attribute table"
                  style={{ border: 0, borderRadius: 5, padding: '5px 7px', background: tableKey === layer.layer_key ? 'var(--surface-selected)' : 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11 }}>
                  Table
                </button>
              </div>
            ))}
          </>
        )}
        {results && mapLayers.length > 0 && <h2 style={{ margin: '18px 0 4px', fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Generated output layers</h2>}
        {results && !mapLayers.length && <p className={s.summary}>This run has no spatial output layers.</p>}
        {mapLayers.map(key => {
          const meta = META[key];
          const count = results?.output_layers[key]?.features?.length ?? 0;
          const canMap = !!meta;
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', fontSize: 13 }}>
              {canMap ? <input aria-label={`Show ${meta.label}`} type="checkbox" checked={visible[key] ?? meta.defaultOn !== false} onChange={e => onToggle(key, e.target.checked)} /> : <span style={{ width: 16, flex: 'none' }} />}
              <span style={{ width: 10, height: 10, borderRadius: meta?.geometry === 'line' ? 2 : '50%', background: meta?.color ?? '#94A3B8', flex: 'none' }} />
              <span style={{ flex: 1 }}>{meta?.label ?? key.replaceAll('_', ' ')}</span>
              <span className={s.summary}>{count}</span>
              <button type="button" onClick={() => onOpenTable(key)} aria-label={`Open ${key} attribute table`}
                aria-pressed={tableKey === key} title="Open attribute table"
                style={{ border: 0, borderRadius: 5, padding: '5px 7px', background: tableKey === key ? 'var(--surface-selected)' : 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11 }}>
                Table
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

type AttributeRow = Record<string, unknown> & { __rowId: number; __geometry: string };

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
}

export function FttxAttributeTable({ runId, layerKey, results, inputLayers = [], onClose }: {
  runId: string; layerKey: string; results?: FttxDesignRunResults; inputLayers?: FttxDesignRunLayer[]; onClose: () => void;
}) {
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const resizeStart = useRef<{ pointerId: number; x: number; y: number; width: number; height: number } | null>(null);
  const inputLayer = inputLayers.find(layer => layer.layer_key === layerKey);
  const inputQuery = useQuery({
    queryKey: ['fttx-designer', 'run', runId, 'input-geojson', layerKey],
    queryFn: () => fttxDesignerApi.getInputLayerGeoJson(runId, layerKey as FttxLayerKey),
    enabled: !!inputLayer,
  });
  const collection = results?.output_layers[layerKey] ?? inputQuery.data;
  const features = collection?.features ?? [];
  const fields = useMemo(() => [...new Set(features.flatMap(f => Object.keys(f.properties ?? {})))], [features]);
  const rows = useMemo<AttributeRow[]>(() => features.map((feature, index) => ({
    ...(feature.properties ?? {}),
    __rowId: index + 1,
    __geometry: (feature.geometry as { type?: string } | null)?.type ?? 'No geometry',
  })), [features]);
  const columns = useMemo<Column<AttributeRow>[]>(() => [
    { key: '__rowId', header: 'FID', width: 80, numeric: true, sortable: true, mono: true, hideable: false },
    { key: '__geometry', header: 'Geometry', width: 120, sortable: true },
    ...fields.map(key => ({
      key, header: key, sortable: true, width: 160,
      render: (value: unknown) => displayValue(value),
      sortValue: (row: AttributeRow) => displayValue(row[key]),
    })),
  ], [fields]);
  const filtered = useMemo(() => {
    const q = filter.trim().toLocaleLowerCase();
    if (!q) return rows;
    return rows.filter(row => fields.some(field => displayValue(row[field]).toLocaleLowerCase().includes(q))
      || String(row.__rowId).includes(q) || row.__geometry.toLocaleLowerCase().includes(q));
  }, [rows, fields, filter]);
  const visibleRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const label = META[layerKey]?.label ?? layerKey.replaceAll('_', ' ');

  const beginResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (maximized) return;
    event.preventDefault();
    const bounds = panelRef.current?.getBoundingClientRect();
    if (!bounds) return;
    resizeStart.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, width: bounds.width, height: bounds.height };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const resize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = resizeStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const workspace = panelRef.current?.parentElement;
    const maxWidth = Math.max(320, (workspace?.clientWidth ?? window.innerWidth) - 16);
    const maxHeight = Math.max(190, (workspace?.clientHeight ?? window.innerHeight) - 16);
    setSize({
      width: Math.max(320, Math.min(maxWidth, start.width + event.clientX - start.x)),
      height: Math.max(190, Math.min(maxHeight, start.height + start.y - event.clientY)),
    });
  };
  const endResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (resizeStart.current?.pointerId === event.pointerId) resizeStart.current = null;
  };

  useEffect(() => { setPage(1); }, [layerKey, filter]);

  return (
    <section ref={panelRef} className={s.attributeTable} data-minimized={minimized} data-maximized={maximized}
      aria-label={`${label} attribute table`}
      style={!maximized ? { width: size?.width, height: minimized ? undefined : size?.height } : undefined}>
      <header className={s.attributeHead}>
        <div>
          <strong>{label} — Attribute Table</strong>
          <span>{filtered.length.toLocaleString()} of {rows.length.toLocaleString()} features</span>
        </div>
        <div className={s.attributeActions}>
          <button type="button" onClick={() => { setMinimized(value => !value); setMaximized(false); }} className={s.attributeClose}
            aria-label={minimized ? 'Restore attribute table' : 'Minimize attribute table'} title={minimized ? 'Restore' : 'Minimize'}>
            {minimized ? <Maximize2 size={16} /> : <Minus size={18} />}
          </button>
          <button type="button" onClick={() => { setMaximized(value => !value); setMinimized(false); }} className={s.attributeClose}
            aria-label={maximized ? 'Restore attribute table size' : 'Maximize attribute table'} title={maximized ? 'Restore size' : 'Maximize'}>
            {maximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button type="button" onClick={onClose} className={s.attributeClose} aria-label="Close attribute table" title="Close"><X size={18} /></button>
        </div>
      </header>
      {!minimized && <>
        <div className={s.attributeGrid}>
          <DataTable<AttributeRow>
            columns={columns} data={visibleRows} rowKey={row => row.__rowId}
            isLoading={inputQuery.isLoading}
            caption={`${label} attributes`} columnChooser densityToggle density="compact"
            toolbar={<Input ariaLabel="Search attributes" value={filter} onChange={setFilter} placeholder="Search any field…" inputStyle={{ height: 32, paddingLeft: 10, paddingRight: 10 }} style={{ margin: 0, width: 250 }} />}
            viewKey={`fttx-attributes-${layerKey}`} maxHeight="calc(100% - 40px)"
            emptyTitle={inputQuery.isError ? 'Could not load layer' : 'No features'}
            emptyMessage={inputQuery.isError ? (designError(inputQuery.error, 'The input layer could not be loaded.') ?? 'The input layer could not be loaded.') : filter ? 'No features match this search.' : 'This layer has no features.'}
            responsive={false}
          />
        </div>
        <Pagination page={page} pageSize={pageSize} total={filtered.length}
          onPage={setPage} onPageSize={setPageSize} pageSizes={[25, 50, 100]} />
      </>}
      {!minimized && !maximized && <button type="button" className={s.attributeResizeHandle}
        aria-label="Resize attribute table" title="Drag to resize"
        onPointerDown={beginResize} onPointerMove={resize} onPointerUp={endResize} onLostPointerCapture={endResize}>
        <Grip size={17} aria-hidden="true" />
      </button>}
    </section>
  );
}

function previewLayers(key: string, source: string): LayerSpecification[] {
  const meta = META[key];
  if (meta.geometry === 'line') return [{
    id: `${source}-line`, type: 'line', source,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': meta.color, 'line-width': key === 'b2c' ? 1.2 : 3, 'line-opacity': key === 'b2c' ? 0.55 : 0.9 },
  }];
  return [{
    id: `${source}-point`, type: 'circle', source,
    paint: {
      'circle-radius': key === 'fdt' ? 8 : key === 'fat' ? 6 : 5,
      'circle-color': meta.color, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 1.5,
    },
  }];
}

export function FttxRunPreviewLayers({ runId, results, visible }: {
  runId: string; results?: FttxDesignRunResults; visible: Visibility;
}) {
  const { map } = useMapInstance();
  const framed = useRef<string | null>(null);
  const configs = Object.keys(results?.output_layers ?? {}).filter(key => META[key]);

  useEffect(() => {
    const allLayers: string[] = [];
    const allSources: string[] = [];
    for (const key of configs) {
      const source = `fttx-preview-${runId}-${key}`;
      const layers = previewLayers(key, source);
      map.addSource(source, { type: 'geojson', data: EMPTY });
      allSources.push(source);
      for (const layer of layers) {
        map.addLayer(layer);
        allLayers.push(layer.id);
      }
    }
    return () => {
      for (const id of allLayers.reverse()) if (map.getLayer(id)) map.removeLayer(id);
      for (const id of allSources) if (map.getSource(id)) map.removeSource(id);
    };
  }, [map, runId, configs.join('|')]);

  useEffect(() => {
    if (!results) return;
    for (const key of configs) {
      const sourceId = `fttx-preview-${runId}-${key}`;
      const source = map.getSource(sourceId) as GeoJSONSource | undefined;
      source?.setData((results.output_layers[key] ?? EMPTY) as unknown as GeoJSON.FeatureCollection);
      for (const layer of previewLayers(key, sourceId)) {
        if (map.getLayer(layer.id)) map.setLayoutProperty(layer.id, 'visibility', (visible[key] ?? META[key].defaultOn !== false) ? 'visible' : 'none');
      }
    }
    if (framed.current !== runId) {
      const box = boundsOf(results);
      if (box) {
        map.fitBounds([[box[0], box[1]], [box[2], box[3]]], { padding: 90, maxZoom: 17, duration: 0 });
      }
      framed.current = runId;
    }
  }, [map, runId, results, visible, configs.join('|')]);
  return null;
}
