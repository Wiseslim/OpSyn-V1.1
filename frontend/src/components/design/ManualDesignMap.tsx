// ============================================================
// OPSYN MANUAL DESIGN MAP — Phase 29
// MapLibre Drawing Integration for manual network design
// Features: Drawing tools, snapping, undo/redo, layer management
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Layers, Eye, EyeOff, Trash2, RotateCcw } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────

export interface DesignFeature {
  id: string;
  type: 'asset' | 'cable' | 'annotation';
  geometry: GeoJSON.Geometry;
  properties: Record<string, any>;
}

export interface DrawingState {
  mode: 'select' | 'draw-point' | 'draw-line' | 'draw-polygon' | 'measure';
  features: DesignFeature[];
  selectedFeatureId: string | null;
  snapEnabled: boolean;
  snapRadius: number;
}

// ── Styles ─────────────────────────────────────────────────────

const MAP_CONTAINER: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  backgroundColor: 'var(--bg2)',
};

const MAP_INNER: React.CSSProperties = {
  width: '100%',
  height: '100%',
};

const LAYER_PANEL: React.CSSProperties = {
  position: 'absolute',
  top: 16,
  right: 16,
  background: 'var(--bg2)',
  border: '1px solid var(--wire2)',
  borderRadius: 10,
  padding: 12,
  minWidth: 220,
  maxHeight: 400,
  overflow: 'auto',
  zIndex: 10,
};

const LAYER_ITEM: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: 8,
  marginBottom: 6,
  borderRadius: 6,
  fontSize: 12,
  cursor: 'pointer',
  transition: 'all .15s',
  userSelect: 'none',
};

const LAYER_TOGGLE: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--chalk3)',
  padding: 4,
  display: 'flex',
  alignItems: 'center',
};

const STATS_PANEL: React.CSSProperties = {
  position: 'absolute',
  bottom: 16,
  left: 16,
  background: 'var(--bg2)',
  border: '1px solid var(--wire2)',
  borderRadius: 10,
  padding: 12,
  fontSize: 12,
  color: 'var(--chalk)',
  zIndex: 10,
};

const STAT_ROW: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  paddingBottom: 8,
  marginBottom: 8,
  borderBottom: '1px solid var(--wire2)',
};

// ── Component Props ───────────────────────────────────────────

interface ManualDesignMapProps {
  designId: string;
  center?: [number, number];
  zoom?: number;
  features?: DesignFeature[]; // Optional: controlled features for workspace mode
  onFeaturesChange?: (features: DesignFeature[]) => void;
  onFeatureSelect?: (featureId: string | null) => void;
  onDrawingStateChange?: (state: DrawingState) => void;
  readOnly?: boolean;
}

// ── Component ──────────────────────────────────────────────────

export default function ManualDesignMap({
  designId,
  center = [0, 0],
  zoom = 13,
  features: externalFeatures,
  onFeaturesChange,
  onFeatureSelect,
  onDrawingStateChange,
  readOnly = false,
}: ManualDesignMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [drawingState, setDrawingState] = useState<DrawingState>({
    mode: 'select',
    features: externalFeatures || [],
    selectedFeatureId: null,
    snapEnabled: true,
    snapRadius: 20,
  });
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({
    assets: true,
    cables: true,
    annotations: true,
    background: true,
  });
  const [drawingHistory, setDrawingHistory] = useState<DesignFeature[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Sync with external features if provided
  useEffect(() => {
    if (externalFeatures) {
      setDrawingState(prev => ({ ...prev, features: externalFeatures }));
    }
  }, [externalFeatures]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: center as [number, number],
      zoom: zoom,
      pitch: 0,
      bearing: 0,
    });

    // Add navigation control
    map.current.addControl(new maplibregl.NavigationControl(), 'top-left');

    // Add source for design features
    map.current.on('load', () => {
      if (!map.current) return;

      // GeoJSON source for design features
      map.current.addSource('design-features', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // Layer for assets
      map.current.addLayer({
        id: 'assets-layer',
        type: 'circle',
        source: 'design-features',
        filter: ['==', ['get', 'type'], 'asset'],
        paint: {
          'circle-radius': 8,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
          'circle-opacity': 0.8,
        },
      });

      // Layer for cables
      map.current.addLayer({
        id: 'cables-layer',
        type: 'line',
        source: 'design-features',
        filter: ['==', ['get', 'type'], 'cable'],
        paint: {
          'line-color': '#0078d4',
          'line-width': 2,
          'line-opacity': 0.7,
        },
      });

      // Layer for annotations
      map.current.addLayer({
        id: 'annotations-layer',
        type: 'symbol',
        source: 'design-features',
        filter: ['==', ['get', 'type'], 'annotation'],
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 12,
          'text-offset': [0, 1.5],
        },
        paint: {
          'text-color': '#000',
          'text-halo-color': '#fff',
          'text-halo-width': 1,
        },
      });

      // Click handler for feature selection
      map.current.on('click', 'assets-layer', (e) => {
        if (readOnly) return;
        const feature = e.features?.[0];
        if (feature) {
          selectFeature(feature.id as string);
        }
      });

      // Change cursor on hover
      map.current.on('mouseenter', 'assets-layer', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = 'pointer';
        }
      });

      map.current.on('mouseleave', 'assets-layer', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = '';
        }
      });
    });

    return () => {
      map.current?.remove();
    };
  }, [readOnly]);

  // Select feature
  const selectFeature = useCallback((featureId: string) => {
    setDrawingState(prev => ({ ...prev, selectedFeatureId: featureId }));
    onFeatureSelect?.(featureId);
  }, [onFeatureSelect]);

  // Add feature to design
  const addFeature = useCallback((feature: DesignFeature) => {
    const newFeatures = [...drawingState.features, feature];
    setDrawingState(prev => ({ ...prev, features: newFeatures }));

    // Add to drawing history
    setDrawingHistory(prev => [...prev.slice(0, historyIndex + 1), newFeatures]);
    setHistoryIndex(prev => prev + 1);

    // Update map source
    if (map.current) {
      const source = map.current.getSource('design-features') as maplibregl.GeoJSONSource;
      if (source) {
        const geojsonFeatures = newFeatures.map(f => ({
          type: 'Feature' as const,
          id: f.id,
          geometry: f.geometry,
          properties: { ...f.properties, type: f.type },
        }));
        source.setData({
          type: 'FeatureCollection',
          features: geojsonFeatures,
        });
      }
    }

    onFeaturesChange?.(newFeatures);
  }, [drawingState.features, historyIndex, onFeaturesChange]);

  // Delete feature
  const deleteFeature = useCallback((featureId: string) => {
    const newFeatures = drawingState.features.filter(f => f.id !== featureId);
    setDrawingState(prev => ({
      ...prev,
      features: newFeatures,
      selectedFeatureId: null,
    }));

    // Update history
    setDrawingHistory(prev => [...prev.slice(0, historyIndex + 1), newFeatures]);
    setHistoryIndex(prev => prev + 1);

    onFeaturesChange?.(newFeatures);
  }, [drawingState.features, historyIndex, onFeaturesChange]);

  // Undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setDrawingState(prev => ({
        ...prev,
        features: drawingHistory[newIndex],
        selectedFeatureId: null,
      }));
      onFeaturesChange?.(drawingHistory[newIndex]);
    }
  }, [drawingHistory, historyIndex, onFeaturesChange]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex < drawingHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setDrawingState(prev => ({
        ...prev,
        features: drawingHistory[newIndex],
        selectedFeatureId: null,
      }));
      onFeaturesChange?.(drawingHistory[newIndex]);
    }
  }, [drawingHistory, historyIndex, onFeaturesChange]);

  // Toggle layer visibility
  const toggleLayerVisibility = useCallback((layerId: string) => {
    setLayerVisibility(prev => ({
      ...prev,
      [layerId]: !prev[layerId],
    }));

    if (map.current) {
      const layerMapId: Record<string, string> = {
        assets: 'assets-layer',
        cables: 'cables-layer',
        annotations: 'annotations-layer',
      };

      const mapLayerId = layerMapId[layerId];
      if (mapLayerId) {
        map.current.setLayoutProperty(
          mapLayerId,
          'visibility',
          layerVisibility[layerId] ? 'none' : 'visible'
        );
      }
    }
  }, [layerVisibility]);

  // Clear all features
  const clearAll = useCallback(() => {
    if (window.confirm('Are you sure you want to clear all design features?')) {
      setDrawingState(prev => ({
        ...prev,
        features: [],
        selectedFeatureId: null,
      }));
      setDrawingHistory([[]]);
      setHistoryIndex(0);
      onFeaturesChange?.([]);
    }
  }, [onFeaturesChange]);

  // Calculate stats
  const stats = {
    assets: drawingState.features.filter(f => f.type === 'asset').length,
    cables: drawingState.features.filter(f => f.type === 'cable').length,
    total: drawingState.features.length,
  };

  return (
    <div style={MAP_CONTAINER}>
      <div style={MAP_INNER} ref={mapContainer} />

      {/* Layer Panel */}
      <div style={LAYER_PANEL}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Layers size={16} style={{ color: 'var(--color-teal)' }} />
          <span style={{ fontWeight: 600, color: 'var(--chalk)' }}>Layers</span>
        </div>

        {(['assets', 'cables', 'annotations', 'background'] as const).map(layerId => (
          <div key={layerId} style={LAYER_ITEM}>
            <button
              onClick={() => toggleLayerVisibility(layerId)}
              style={LAYER_TOGGLE}
              title={`Toggle ${layerId} visibility`}
            >
              {layerVisibility[layerId] ? (
                <Eye size={14} />
              ) : (
                <EyeOff size={14} style={{ opacity: 0.4 }} />
              )}
            </button>
            <span style={{ flex: 1, textTransform: 'capitalize', color: 'var(--chalk)' }}>
              {layerId}
            </span>
          </div>
        ))}

        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--wire2)' }}>
          <button
            onClick={clearAll}
            disabled={readOnly || drawingState.features.length === 0}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'rgba(220,38,38,.10)',
              border: '1px solid rgba(220,38,38,.3)',
              color: 'var(--color-red)',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              opacity: readOnly || drawingState.features.length === 0 ? 0.5 : 1,
            }}
          >
            <Trash2 size={12} />
            Clear All
          </button>
        </div>
      </div>

      {/* Statistics Panel */}
      <div style={STATS_PANEL}>
        <div style={STAT_ROW}>
          <span style={{ color: 'var(--chalk3)' }}>Assets:</span>
          <span style={{ fontWeight: 600 }}>{stats.assets}</span>
        </div>
        <div style={STAT_ROW}>
          <span style={{ color: 'var(--chalk3)' }}>Cables:</span>
          <span style={{ fontWeight: 600 }}>{stats.cables}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--chalk3)' }}>Total:</span>
          <span style={{ fontWeight: 600 }}>{stats.total}</span>
        </div>
      </div>
    </div>
  );
}