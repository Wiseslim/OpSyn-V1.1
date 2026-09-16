// ============================================================
// OPSYN INFRA MAP VIEW — src/pages/infrastructure/InfraMapView.tsx
// Leaflet-based GIS map with 8 toggleable layers:
//   1. Site Markers      (OLT/POP circles coloured by utilisation)
//   2. Fiber Routes      (polylines coloured by status)
//   3. Util Heatmap      (fill circles coloured by capacity %)
//   4. OLTs              (uploaded OLT assets — cyan squares)
//   5. Cabinets          (uploaded distribution cabinets — amber)
//   6. Splitter Boxes    (uploaded splitters — purple, level-differentiated)
//   7. On-Call Staff     (shift assignments for today — hidden by default)
//   8. Coverage Demand   (subscriber locations — hidden by default)
// ============================================================

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MapContainer,
  TileLayer,
  LayersControl,
  LayerGroup,
  CircleMarker,
  Circle,
  Polyline,
  Popup,
  useMap,
} from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { infrastructureApi, shiftsApi } from '../../api/index';
import type {
  InfraMapData,
  InfraMapSite,
  InfraMapNode,
  InfraMapRoute,
  InfraMapCabinet,
  InfraMapOLT,
  InfraMapSplitter,
  InfraUtilisationPoint,
} from '@shared';

// ── colour helpers ────────────────────────────────────────────

function siteMarkerColor(site: InfraMapSite, utilPct: number): string {
  if (site.has_alert)             return '#f87171';
  if (site.status !== 'active')   return '#6b7280';
  if (utilPct >= 90)              return '#f87171';
  if (utilPct >= 70)              return '#fb923c';
  return '#4ade80';
}

function routeColor(status: string): string {
  if (status === 'active')                             return '#4ade80';
  if (status === 'degraded' || status === 'maintenance') return '#fb923c';
  if (status === 'cut'      || status === 'inactive')  return '#f87171';
  return '#22d3ee';
}

function routeWeight(cableType?: string): number {
  if (!cableType) return 2;
  const ct = cableType.toLowerCase();
  if (ct.includes('trunk') || ct.includes('core')) return 4;
  if (ct.includes('dist')  || ct.includes('feed')) return 3;
  return 2;
}

function utilHeatColor(pct: number): string {
  if (pct >= 90) return '#f87171';
  if (pct >= 70) return '#fb923c';
  return '#4ade80';
}

function subscriberColor(serviceType: string): string {
  switch (serviceType.toUpperCase()) {
    case 'FTTH':     return '#38bdf8';
    case 'FTTB':     return '#818cf8';
    case 'FTTC':     return '#fb923c';
    case 'WIRELESS': return '#facc15';
    default:         return '#94a3b8';
  }
}

// Splitter First-Level = indigo, Second-Level = violet
function splitterColor(level: string): string {
  return level === 'Second-Level' ? '#c084fc' : '#818cf8';
}

// ── BoundsAdjuster ────────────────────────────────────────────
// Fits map to all geo-referenced points (sites + uploaded assets).

function BoundsAdjuster({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    const bounds = points.reduce<[[number, number], [number, number]]>(
      ([min, max], [lat, lng]) => [
        [Math.min(min[0], lat), Math.min(min[1], lng)],
        [Math.max(max[0], lat), Math.max(max[1], lng)],
      ],
      [[points[0][0], points[0][1]], [points[0][0], points[0][1]]],
    );
    try {
      map.fitBounds(bounds as LatLngBoundsExpression, { padding: [40, 40], maxZoom: 13 });
    } catch {
      // no-op if bounds invalid
    }
  }, [map, points.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// ── Detail panels ─────────────────────────────────────────────

interface PanelSite  extends InfraMapSite  { utilPct: number; utilUsed: number; utilTotal: number }
interface PanelRoute extends InfraMapRoute { fromName?: string; toName?: string }

const panelBase: React.CSSProperties = {
  position: 'absolute', top: 12, right: 12, zIndex: 1000,
  background: 'var(--bg2)', border: '1px solid var(--wire2)', borderRadius: 12,
  padding: 16, boxShadow: '0 8px 32px rgba(0,0,0,.4)',
};

function PanelRow({ label, val }: { label: string; val: string | number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--wire)', fontSize: 11 }}>
      <span style={{ color: 'var(--chalk3)' }}>{label}</span>
      <span style={{ color: 'var(--chalk)', fontWeight: 500 }}>{val}</span>
    </div>
  );
}

function CloseBtn({ onClose }: { onClose: () => void }) {
  return (
    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--chalk3)', fontSize: 16, lineHeight: 1 }}>×</button>
  );
}

function SitePanel({ site, onClose }: { site: PanelSite; onClose: () => void }) {
  return (
    <div style={{ ...panelBase, width: 260 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--chalk)' }}>{site.name}</div>
          <div style={{ fontSize: 10, color: 'var(--chalk3)', marginTop: 2 }}>{site.site_type}</div>
        </div>
        <CloseBtn onClose={onClose} />
      </div>
      <PanelRow label="Status"    val={site.status} />
      <PanelRow label="Region"    val={site.region_id ? site.region_id.slice(0, 8) + '…' : '—'} />
      <PanelRow label="Monitored" val={site.is_monitored ? 'Yes' : 'No'} />
      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
          <span style={{ color: 'var(--chalk3)' }}>Capacity</span>
          <span style={{ color: utilHeatColor(site.utilPct), fontWeight: 700 }}>{site.utilPct}%</span>
        </div>
        <div style={{ background: 'var(--bg4)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
          <div style={{ width: `${site.utilPct}%`, height: '100%', borderRadius: 4, background: utilHeatColor(site.utilPct), transition: 'width .5s' }} />
        </div>
        <div style={{ fontSize: 10, color: 'var(--chalk3)', marginTop: 4 }}>Used {site.utilUsed} / {site.utilTotal} ONUs</div>
      </div>
      {site.has_alert && (
        <div style={{ marginTop: 10, padding: '6px 10px', background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 7, fontSize: 10, color: '#f87171' }}>
          ⚠ Active capacity alert
        </div>
      )}
    </div>
  );
}

function RoutePanel({ route, onClose }: { route: PanelRoute; onClose: () => void }) {
  return (
    <div style={{ ...panelBase, width: 240 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--chalk)' }}>Fiber Route</div>
        <CloseBtn onClose={onClose} />
      </div>
      <PanelRow label="From"     val={route.fromName ?? route.from_node_id.slice(0, 8) + '…'} />
      <PanelRow label="To"       val={route.toName   ?? route.to_node_id.slice(0, 8)   + '…'} />
      <PanelRow label="Cable"    val={route.cable_type    ?? '—'} />
      <PanelRow label="Length"   val={route.length_km     ? `${route.length_km.toFixed(2)} km` : '—'} />
      <PanelRow label="Capacity" val={route.capacity_gbps ? `${route.capacity_gbps} Gbps`      : '—'} />
      <PanelRow label="Status"   val={route.status} />
    </div>
  );
}

function OLTPanel({ olt, onClose }: { olt: InfraMapOLT; onClose: () => void }) {
  return (
    <div style={{ ...panelBase, width: 240 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--chalk)' }}>{olt.name}</div>
          <div style={{ fontSize: 10, color: '#22d3ee', marginTop: 2 }}>OLT</div>
        </div>
        <CloseBtn onClose={onClose} />
      </div>
      <PanelRow label="Location" val={olt.location_description ?? '—'} />
      <PanelRow label="ODF ports" val={olt.number_of_odf ?? '—'} />
      <PanelRow label="Lat"      val={olt.latitude.toFixed(6)} />
      <PanelRow label="Lng"      val={olt.longitude.toFixed(6)} />
    </div>
  );
}

function CabinetPanel({ cabinet, onClose }: { cabinet: InfraMapCabinet; onClose: () => void }) {
  return (
    <div style={{ ...panelBase, width: 240 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--chalk)' }}>{cabinet.cabinet_id}</div>
          <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 2 }}>Cabinet</div>
        </div>
        <CloseBtn onClose={onClose} />
      </div>
      <PanelRow label="Capacity"   val={cabinet.capacity} />
      <PanelRow label="Trays"      val={cabinet.number_tray ?? '—'} />
      <PanelRow label="Lat"        val={cabinet.latitude.toFixed(6)} />
      <PanelRow label="Lng"        val={cabinet.longitude.toFixed(6)} />
    </div>
  );
}

function SplitterPanel({ splitter, onClose }: { splitter: InfraMapSplitter; onClose: () => void }) {
  const color = splitterColor(splitter.splitter_level);
  return (
    <div style={{ ...panelBase, width: 240 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--chalk)' }}>{splitter.box_id}</div>
          <div style={{ fontSize: 10, color, marginTop: 2 }}>{splitter.splitter_level} · {splitter.splitter_type}</div>
        </div>
        <CloseBtn onClose={onClose} />
      </div>
      <PanelRow label="Input ports"  val={splitter.input_ports} />
      <PanelRow label="Output ports" val={splitter.output_ports} />
      <PanelRow label="Customers"    val={splitter.number_customer ?? 0} />
      <PanelRow label="Lat"          val={splitter.latitude.toFixed(6)} />
      <PanelRow label="Lng"          val={splitter.longitude.toFixed(6)} />
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────

function MapLegend() {
  return (
    <div style={{
      position: 'absolute', bottom: 28, left: 12, zIndex: 1000,
      background: 'var(--bg2)', border: '1px solid var(--wire2)', borderRadius: 8,
      padding: '8px 12px', fontSize: 10, color: 'var(--chalk3)',
      maxHeight: 'calc(100% - 60px)', overflowY: 'auto',
    }}>
      <div style={{ fontWeight: 700, color: 'var(--chalk)', marginBottom: 6 }}>Site Capacity</div>
      {[['#4ade80', '< 70%'], ['#fb923c', '70–90%'], ['#f87171', '≥ 90% / Alert']].map(([c, l]) => (
        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'block', flexShrink: 0 }} />
          <span>{l}</span>
        </div>
      ))}
      <div style={{ height: 1, background: 'var(--wire)', margin: '6px 0' }} />
      <div style={{ fontWeight: 700, color: 'var(--chalk)', marginBottom: 6 }}>Routes</div>
      {[['#4ade80', 'Active'], ['#fb923c', 'Maintenance'], ['#f87171', 'Cut / Down']].map(([c, l]) => (
        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ width: 20, height: 3, background: c, display: 'block', borderRadius: 1, flexShrink: 0 }} />
          <span>{l}</span>
        </div>
      ))}
      <div style={{ height: 1, background: 'var(--wire)', margin: '6px 0' }} />
      <div style={{ fontWeight: 700, color: 'var(--chalk)', marginBottom: 6 }}>FTTH Assets</div>
      {[
        ['#22d3ee', 'OLT', '◆'],
        ['#f59e0b', 'Cabinet', '●'],
        ['#818cf8', 'Splitter L1', '●'],
        ['#c084fc', 'Splitter L2', '●'],
      ].map(([c, l, shape]) => (
        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ color: c, fontSize: 12, lineHeight: 1, flexShrink: 0 }}>{shape}</span>
          <span>{l}</span>
        </div>
      ))}
      <div style={{ height: 1, background: 'var(--wire)', margin: '6px 0' }} />
      <div style={{ fontWeight: 700, color: 'var(--chalk)', marginBottom: 6 }}>Subscribers</div>
      {[['#38bdf8', 'FTTH'], ['#818cf8', 'FTTB'], ['#fb923c', 'FTTC'], ['#facc15', 'Wireless']].map(([c, l]) => (
        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'block', flexShrink: 0 }} />
          <span>{l}</span>
        </div>
      ))}
    </div>
  );
}

// ══ MAIN COMPONENT ════════════════════════════════════════════

type SelectedAsset =
  | { type: 'site';     data: PanelSite }
  | { type: 'route';    data: PanelRoute }
  | { type: 'olt';      data: InfraMapOLT }
  | { type: 'cabinet';  data: InfraMapCabinet }
  | { type: 'splitter'; data: InfraMapSplitter };

export default function InfraMapView() {
  const [selected, setSelected] = useState<SelectedAsset | null>(null);

  const { data: mapData, isLoading: mapLoading } = useQuery<InfraMapData>({
    queryKey: ['infra', 'map'],
    queryFn:  () => infrastructureApi.getMap(),
    refetchInterval: 60_000,
  });

  const { data: utilData = [] } = useQuery<InfraUtilisationPoint[]>({
    queryKey: ['infra', 'utilisation'],
    queryFn:  () => infrastructureApi.getUtilisation(),
    refetchInterval: 60_000,
  });

  const { data: subscribersData = [] } = useQuery<any[]>({
    queryKey: ['infra', 'subscribers'],
    queryFn:  () => infrastructureApi.listSubscribers() as any,
    refetchInterval: 120_000,
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: shiftsWeekly } = useQuery({
    queryKey: ['shifts', 'weekly', todayStr],
    queryFn:  () => shiftsApi.getWeekly(todayStr),
    refetchInterval: 300_000,
  });

  // ── Derived lookup maps ──────────────────────────────────────
  const siteMap = useMemo(() => {
    const m: Record<string, InfraMapSite> = {};
    mapData?.sites.forEach(s => { m[s.id] = s; });
    return m;
  }, [mapData]);

  const nodeMap = useMemo(() => {
    const m: Record<string, InfraMapNode> = {};
    mapData?.nodes.forEach(n => { m[n.id] = n; });
    return m;
  }, [mapData]);

  const siteUtilMap = useMemo(() => {
    const m: Record<string, { pct: number; used: number; total: number }> = {};
    utilData.forEach(u => { m[u.site_id] = { pct: u.utilisation_pct, used: u.used, total: u.total }; });
    return m;
  }, [utilData]);

  const nodeCoord = (nodeId: string): [number, number] | null => {
    const node = nodeMap[nodeId];
    if (!node?.site_id) return null;
    const site = siteMap[node.site_id];
    if (!site?.latitude || !site?.longitude) return null;
    return [site.latitude, site.longitude];
  };

  // All geo-referenced points — sites + all uploaded FTTH assets.
  // Used by BoundsAdjuster so the map auto-fits even if there are no sites yet.
  const allPoints = useMemo(() => {
    const pts: [number, number][] = [];
    (mapData?.sites ?? []).forEach(s => {
      if (s.latitude && s.longitude) pts.push([s.latitude, s.longitude]);
    });
    (mapData?.olts      ?? []).forEach(o => pts.push([o.latitude, o.longitude]));
    (mapData?.cabinets  ?? []).forEach(c => pts.push([c.latitude, c.longitude]));
    (mapData?.splitters ?? []).forEach(s => pts.push([s.latitude, s.longitude]));
    return pts;
  }, [mapData]);

  const onCallMarkers = useMemo(() => {
    if (!shiftsWeekly || !Array.isArray(shiftsWeekly)) return [];
    return (shiftsWeekly as any[]).filter((row: any) => {
      const todayAssign = row.assignments?.[todayStr];
      return todayAssign?.shift?.shift_type === 'oncall';
    });
  }, [shiftsWeekly, todayStr]);

  if (mapLoading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 500, color: 'var(--chalk3)', fontSize: 12 }}>
        Loading infrastructure map…
      </div>
    );
  }

  const sites    = mapData?.sites    ?? [];
  const nodes    = mapData?.nodes    ?? [];
  const routes   = mapData?.routes   ?? [];
  const olts     = mapData?.olts     ?? [];
  const cabinets = mapData?.cabinets ?? [];
  const splitters = mapData?.splitters ?? [];

  // Close any panel when a different marker type is clicked
  const sel = (asset: SelectedAsset) => setSelected(asset);
  const clearSel = () => setSelected(null);

  return (
    <div style={{ position: 'relative', height: 'calc(100vh - 220px)', minHeight: 480, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--wire)' }}>
      <MapContainer
        center={allPoints.length ? allPoints[0] : [9.0820, 8.6753]}
        zoom={7}
        style={{ height: '100%', width: '100%', background: '#0d1117' }}
        zoomControl
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com">CARTO</a>'
          maxZoom={19}
        />

        {allPoints.length > 1 && <BoundsAdjuster points={allPoints} />}

        <LayersControl position="topright">

          {/* ── Layer 1: Site Markers ── */}
          <LayersControl.Overlay name="Site Markers" checked>
            <LayerGroup>
              {sites.filter(s => s.latitude && s.longitude).map(site => {
                const util  = siteUtilMap[site.id] ?? { pct: 0, used: 0, total: 0 };
                const color = siteMarkerColor(site, util.pct);
                return (
                  <CircleMarker
                    key={site.id}
                    center={[site.latitude!, site.longitude!]}
                    radius={site.site_type === 'POP' || site.site_type === 'data_centre' ? 10 : 7}
                    pathOptions={{
                      fillColor: color, fillOpacity: 0.85,
                      color: site.has_alert ? '#fef08a' : color,
                      weight: site.has_alert ? 2 : 1,
                    }}
                    eventHandlers={{ click: () => sel({ type: 'site', data: { ...site, utilPct: util.pct, utilUsed: util.used, utilTotal: util.total } }) }}
                  >
                    <Popup>
                      <div style={{ fontFamily: 'monospace', fontSize: 12, minWidth: 140 }}>
                        <strong>{site.name}</strong><br />
                        {site.site_type} · {site.status}<br />
                        Capacity: <span style={{ color }}>{util.pct}%</span>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </LayerGroup>
          </LayersControl.Overlay>

          {/* ── Layer 2: Fiber Routes ── */}
          <LayersControl.Overlay name="Fiber Routes" checked>
            <LayerGroup>
              {routes.map(route => {
                const fromCoord = nodeCoord(route.from_node_id);
                const toCoord   = nodeCoord(route.to_node_id);
                if (!fromCoord || !toCoord) return null;
                const color  = routeColor(route.status);
                const weight = routeWeight(route.cable_type);
                const panelRoute: PanelRoute = {
                  ...route,
                  fromName: nodeMap[route.from_node_id]?.name,
                  toName:   nodeMap[route.to_node_id]?.name,
                };
                return (
                  <Polyline
                    key={route.id}
                    positions={[fromCoord, toCoord]}
                    pathOptions={{ color, weight, opacity: 0.75 }}
                    eventHandlers={{ click: () => sel({ type: 'route', data: panelRoute }) }}
                  >
                    <Popup>
                      <div style={{ fontFamily: 'monospace', fontSize: 12, minWidth: 140 }}>
                        <strong>{panelRoute.fromName ?? '?'} → {panelRoute.toName ?? '?'}</strong><br />
                        {route.cable_type ?? 'Fiber'} · {route.status}<br />
                        {route.length_km    ? `${route.length_km.toFixed(1)} km`  : ''}
                        {route.capacity_gbps ? ` · ${route.capacity_gbps} Gbps` : ''}
                      </div>
                    </Popup>
                  </Polyline>
                );
              })}
            </LayerGroup>
          </LayersControl.Overlay>

          {/* ── Layer 3: Utilisation Heatmap ── */}
          <LayersControl.Overlay name="Utilisation Heatmap" checked>
            <LayerGroup>
              {utilData.filter(u => u.latitude && u.longitude).map(u => {
                const color  = utilHeatColor(u.utilisation_pct);
                const radius = Math.max(400, Math.min(2000, u.total * 8));
                return (
                  <Circle
                    key={u.site_id}
                    center={[u.latitude!, u.longitude!]}
                    radius={radius}
                    pathOptions={{ fillColor: color, fillOpacity: 0.22, color, weight: 0 }}
                  >
                    <Popup>
                      <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
                        <strong>{u.name}</strong><br />
                        Used {u.used} / {u.total} ({u.utilisation_pct}%)
                      </div>
                    </Popup>
                  </Circle>
                );
              })}
            </LayerGroup>
          </LayersControl.Overlay>

          {/* ── Layer 4: OLTs (uploaded) ── */}
          <LayersControl.Overlay name="OLTs" checked>
            <LayerGroup>
              {olts.length === 0 && (
                <CircleMarker center={[0, 0]} radius={0} pathOptions={{ opacity: 0 }} />
              )}
              {olts.map(olt => (
                <CircleMarker
                  key={olt.id}
                  center={[olt.latitude, olt.longitude]}
                  radius={9}
                  pathOptions={{ fillColor: '#22d3ee', fillOpacity: 0.9, color: '#0e7490', weight: 2 }}
                  eventHandlers={{ click: () => sel({ type: 'olt', data: olt }) }}
                >
                  <Popup>
                    <div style={{ fontFamily: 'monospace', fontSize: 12, minWidth: 150 }}>
                      <strong>{olt.name}</strong><br />
                      OLT · {olt.location_description ?? ''}<br />
                      {olt.number_of_odf != null ? `${olt.number_of_odf} ODF ports` : ''}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </LayerGroup>
          </LayersControl.Overlay>

          {/* ── Layer 5: Cabinets (uploaded) ── */}
          <LayersControl.Overlay name="Cabinets" checked>
            <LayerGroup>
              {cabinets.length === 0 && (
                <CircleMarker center={[0, 0]} radius={0} pathOptions={{ opacity: 0 }} />
              )}
              {cabinets.map(cab => (
                <CircleMarker
                  key={cab.id}
                  center={[cab.latitude, cab.longitude]}
                  radius={7}
                  pathOptions={{ fillColor: '#f59e0b', fillOpacity: 0.88, color: '#b45309', weight: 1.5 }}
                  eventHandlers={{ click: () => sel({ type: 'cabinet', data: cab }) }}
                >
                  <Popup>
                    <div style={{ fontFamily: 'monospace', fontSize: 12, minWidth: 140 }}>
                      <strong>{cab.cabinet_id}</strong><br />
                      Cabinet · {cab.capacity} cap<br />
                      {cab.number_tray != null ? `${cab.number_tray} trays` : ''}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </LayerGroup>
          </LayersControl.Overlay>

          {/* ── Layer 6: Splitter Boxes (uploaded) ── */}
          <LayersControl.Overlay name="Splitter Boxes" checked>
            <LayerGroup>
              {splitters.length === 0 && (
                <CircleMarker center={[0, 0]} radius={0} pathOptions={{ opacity: 0 }} />
              )}
              {splitters.map(spl => {
                const color = splitterColor(spl.splitter_level);
                return (
                  <CircleMarker
                    key={spl.id}
                    center={[spl.latitude, spl.longitude]}
                    radius={5}
                    pathOptions={{ fillColor: color, fillOpacity: 0.85, color, weight: 1 }}
                    eventHandlers={{ click: () => sel({ type: 'splitter', data: spl }) }}
                  >
                    <Popup>
                      <div style={{ fontFamily: 'monospace', fontSize: 12, minWidth: 140 }}>
                        <strong>{spl.box_id}</strong><br />
                        {spl.splitter_level} · {spl.splitter_type}<br />
                        {spl.input_ports}:{spl.output_ports} split
                        {spl.number_customer != null ? ` · ${spl.number_customer} customers` : ''}
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </LayerGroup>
          </LayersControl.Overlay>

          {/* ── Layer 7: On-Call Staff ── */}
          <LayersControl.Overlay name="On-Call Staff (today)">
            <LayerGroup>
              {onCallMarkers.length === 0 && (
                <CircleMarker center={[0, 0]} radius={0} pathOptions={{ opacity: 0 }} />
              )}
              {onCallMarkers.map((row: any, i: number) => {
                const assign = row.assignments?.[todayStr];
                if (!assign) return null;
                return (
                  <CircleMarker
                    key={i}
                    center={[6.5244, 3.3792 + i * 0.05]}
                    radius={8}
                    pathOptions={{ fillColor: '#a78bfa', fillOpacity: 0.8, color: '#a78bfa', weight: 1 }}
                  >
                    <Popup>
                      <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
                        <strong>{row.name ?? 'Staff'}</strong><br />
                        On-call · {assign.shift?.name ?? 'Oncall Shift'}
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </LayerGroup>
          </LayersControl.Overlay>

          {/* ── Layer 8: Coverage Demand ── */}
          <LayersControl.Overlay name="Coverage Demand">
            <LayerGroup>
              {subscribersData.filter((s: any) => s.latitude && s.longitude).length === 0 && (
                <CircleMarker center={[0, 0]} radius={0} pathOptions={{ opacity: 0 }} />
              )}
              {subscribersData
                .filter((s: any) => s.latitude && s.longitude)
                .map((sub: any) => {
                  const color = subscriberColor(sub.service_type);
                  return (
                    <CircleMarker
                      key={sub.id}
                      center={[sub.latitude, sub.longitude]}
                      radius={4}
                      pathOptions={{ fillColor: color, fillOpacity: 0.75, color, weight: 1 }}
                    >
                      <Popup>
                        <div style={{ fontFamily: 'monospace', fontSize: 12, minWidth: 130 }}>
                          <strong>{sub.customer_id}</strong><br />
                          {sub.service_type} · {sub.status}<br />
                          {sub.address ?? ''}
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })
              }
            </LayerGroup>
          </LayersControl.Overlay>

        </LayersControl>
      </MapContainer>

      {/* ── Detail panels ── */}
      {selected?.type === 'site'     && <SitePanel     site={selected.data}     onClose={clearSel} />}
      {selected?.type === 'route'    && <RoutePanel    route={selected.data}    onClose={clearSel} />}
      {selected?.type === 'olt'      && <OLTPanel      olt={selected.data}      onClose={clearSel} />}
      {selected?.type === 'cabinet'  && <CabinetPanel  cabinet={selected.data}  onClose={clearSel} />}
      {selected?.type === 'splitter' && <SplitterPanel splitter={selected.data} onClose={clearSel} />}

      {/* ── Legend ── */}
      <MapLegend />

      {/* ── Stats strip ── */}
      <div style={{
        position: 'absolute', top: 12, left: 12, zIndex: 1000,
        display: 'flex', gap: 6, flexWrap: 'wrap',
      }}>
        {[
          { label: 'Sites',       val: sites.length,       color: 'var(--cyan)'  },
          { label: 'Nodes',       val: nodes.length,       color: 'var(--green)' },
          { label: 'Routes',      val: routes.length,      color: 'var(--amber)' },
          { label: 'OLTs',        val: olts.length,        color: '#22d3ee'      },
          { label: 'Cabinets',    val: cabinets.length,    color: '#f59e0b'      },
          { label: 'Splitters',   val: splitters.length,   color: '#818cf8'      },
          { label: 'Alerts',      val: sites.filter(s => s.has_alert).length, color: 'var(--rose)' },
          { label: 'Subscribers', val: subscribersData.length, color: '#38bdf8'  },
        ].map(s => (
          <div key={s.label} style={{
            background: 'rgba(5,8,16,.85)', border: '1px solid var(--wire2)', borderRadius: 7,
            padding: '4px 10px', fontSize: 10, color: 'var(--chalk3)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontWeight: 700, color: s.color, fontFamily: 'var(--mono)' }}>{s.val}</span>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
