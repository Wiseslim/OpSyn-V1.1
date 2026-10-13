// ============================================================
// OPSYN ASSET PALETTE — Phase 27
// Equipment catalog palette for drag-and-drop asset placement
// Categories: OLTs, FDTs, FATs, Poles, Cabinets, Closures
// ============================================================

import { useState, useMemo } from 'react';
import { Search, ChevronDown, Package, MapPin } from 'lucide-react';

// ── Asset Types ────────────────────────────────────────────────

export type AssetCategory = 'olt' | 'fdt' | 'fat' | 'pole' | 'cabinet' | 'closure' | 'splitter';

export interface AssetItem {
  id: string;
  code: string;
  name: string;
  category: AssetCategory;
  description?: string;
  specifications?: Record<string, string>;
  icon: string;
  color: string;
  draggable: boolean;
}

const ASSET_CATEGORIES: Record<AssetCategory, { label: string; color: string; icon: string }> = {
  olt: { label: 'OLTs', color: 'var(--color-teal)', icon: '📡' },
  fdt: { label: 'FDTs (Distribution)', color: 'var(--color-blue)', icon: '📦' },
  fat: { label: 'FATs (Access)', color: 'var(--color-green)', icon: '🔌' },
  pole: { label: 'Poles', color: 'var(--color-amber)', icon: '🏗️' },
  cabinet: { label: 'Cabinets', color: 'var(--color-purple)', icon: '🗄️' },
  closure: { label: 'Closures', color: 'var(--color-red)', icon: '🔒' },
  splitter: { label: 'Splitters', color: 'var(--color-indigo)', icon: '⚡' },
};

// Mock asset catalog - replace with API call in real implementation
const DEFAULT_ASSETS: AssetItem[] = [
  // OLTs
  {
    id: 'olt-1',
    code: 'OLT-001',
    name: 'Huawei MA5800-X15',
    category: 'olt',
    description: 'Optical Line Terminal - 48 port',
    specifications: { ports: '48', capacity: '2.4Tbps', power: '3kW' },
    icon: '📡',
    color: 'var(--color-teal)',
    draggable: true,
  },
  {
    id: 'olt-2',
    code: 'OLT-002',
    name: 'Nokia MDC-XYZ',
    category: 'olt',
    description: 'Optical Line Terminal - 32 port',
    specifications: { ports: '32', capacity: '1.6Tbps', power: '2.5kW' },
    icon: '📡',
    color: 'var(--color-teal)',
    draggable: true,
  },
  // FDTs
  {
    id: 'fdt-1',
    code: 'FDT-PON-1:2',
    name: 'FDT 1:2 Splitter',
    category: 'fdt',
    description: 'Fiber Distribution Terminal with 1:2 splitter',
    specifications: { capacity: '2 branches', splitter: '1:2' },
    icon: '📦',
    color: 'var(--color-blue)',
    draggable: true,
  },
  {
    id: 'fdt-2',
    code: 'FDT-PON-1:4',
    name: 'FDT 1:4 Splitter',
    category: 'fdt',
    description: 'Fiber Distribution Terminal with 1:4 splitter',
    specifications: { capacity: '4 branches', splitter: '1:4' },
    icon: '📦',
    color: 'var(--color-blue)',
    draggable: true,
  },
  {
    id: 'fdt-3',
    code: 'FDT-PON-1:8',
    name: 'FDT 1:8 Splitter',
    category: 'fdt',
    description: 'Fiber Distribution Terminal with 1:8 splitter',
    specifications: { capacity: '8 branches', splitter: '1:8' },
    icon: '📦',
    color: 'var(--color-blue)',
    draggable: true,
  },
  // FATs
  {
    id: 'fat-1',
    code: 'FAT-STD-8',
    name: 'FAT 8-port Standard',
    category: 'fat',
    description: 'Fiber Access Terminal - 8 customer ports',
    specifications: { ports: '8', drop: '4 fibers' },
    icon: '🔌',
    color: 'var(--color-green)',
    draggable: true,
  },
  {
    id: 'fat-2',
    code: 'FAT-STD-4',
    name: 'FAT 4-port Standard',
    category: 'fat',
    description: 'Fiber Access Terminal - 4 customer ports',
    specifications: { ports: '4', drop: '2 fibers' },
    icon: '🔌',
    color: 'var(--color-green)',
    draggable: true,
  },
  // Poles
  {
    id: 'pole-1',
    code: 'POLE-STD-10M',
    name: 'Concrete Pole 10m',
    category: 'pole',
    description: 'Standard concrete utility pole',
    specifications: { height: '10m', capacity: '500kg', type: 'Concrete' },
    icon: '🏗️',
    color: 'var(--color-amber)',
    draggable: true,
  },
  {
    id: 'pole-2',
    code: 'POLE-STD-12M',
    name: 'Concrete Pole 12m',
    category: 'pole',
    description: 'Heavy-duty concrete utility pole',
    specifications: { height: '12m', capacity: '750kg', type: 'Concrete' },
    icon: '🏗️',
    color: 'var(--color-amber)',
    draggable: true,
  },
  // Cabinets
  {
    id: 'cabinet-1',
    code: 'CAB-WALL-STD',
    name: 'Wall Cabinet',
    category: 'cabinet',
    description: 'Wall-mounted distribution cabinet',
    specifications: { trays: '12', capacity: '144 fibers' },
    icon: '🗄️',
    color: 'var(--color-purple)',
    draggable: true,
  },
  // Closures
  {
    id: 'closure-1',
    code: 'CLOSURE-STD-6',
    name: 'Closure 6-way',
    category: 'closure',
    description: 'Standard 6-way closure box',
    specifications: { capacity: '6 fibers', weatherproof: 'IP67' },
    icon: '🔒',
    color: 'var(--color-red)',
    draggable: true,
  },
  // Splitters
  {
    id: 'splitter-1',
    code: 'SPLITTER-1:2',
    name: 'Optical Splitter 1:2',
    category: 'splitter',
    description: 'Passive optical splitter 1:2',
    specifications: { ratio: '1:2', wavelength: '1310nm' },
    icon: '⚡',
    color: 'var(--color-indigo)',
    draggable: true,
  },
];

// ── Styles ─────────────────────────────────────────────────────

const CONTAINER: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--bg2)',
  border: '1px solid var(--wire2)',
  borderRadius: 10,
  overflow: 'hidden',
  maxHeight: 600,
  minWidth: 260,
};

const HEADER: React.CSSProperties = {
  padding: 12,
  borderBottom: '1px solid var(--wire2)',
  flexShrink: 0,
};

const SEARCH_INPUT: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px 8px 32px',
  background: 'var(--bg3)',
  border: '1px solid var(--wire2)',
  borderRadius: 8,
  color: 'var(--chalk)',
  fontFamily: 'var(--font)',
  fontSize: 12,
  outline: 'none',
  boxSizing: 'border-box',
  position: 'relative',
};

const CONTENT: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: 8,
};

const CATEGORY_SECTION: React.CSSProperties = {
  marginBottom: 12,
};

const CATEGORY_HEADER: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: 8,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--chalk)',
  userSelect: 'none',
  transition: 'all .15s',
};

const ASSET_CARD: React.CSSProperties = {
  padding: 10,
  margin: 4,
  background: 'var(--bg3)',
  border: '1px solid var(--wire2)',
  borderRadius: 6,
  cursor: 'grab',
  fontSize: 11,
  transition: 'all .15s',
  userSelect: 'none',
};

// ── Component Props ───────────────────────────────────────────

interface AssetPaletteProps {
  assets?: AssetItem[];
  onAssetSelect?: (asset: AssetItem) => void;
  onAssetDragStart?: (asset: AssetItem, e: React.DragEvent) => void;
  loading?: boolean;
  searchPlaceholder?: string;
}

// ── Component ──────────────────────────────────────────────────

export default function AssetPalette({
  assets = DEFAULT_ASSETS,
  onAssetSelect,
  onAssetDragStart,
  loading = false,
  searchPlaceholder = 'Search assets...',
}: AssetPaletteProps) {
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<AssetCategory>>(
    new Set(Object.keys(ASSET_CATEGORIES) as AssetCategory[])
  );

  // Filter assets by search
  const filteredAssets = useMemo(() => {
    if (!search.trim()) return assets;
    const q = search.toLowerCase();
    return assets.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.code.toLowerCase().includes(q) ||
      a.description?.toLowerCase().includes(q)
    );
  }, [assets, search]);

  // Group assets by category
  const groupedAssets = useMemo(() => {
    const groups: Record<AssetCategory, AssetItem[]> = {} as any;
    for (const cat of Object.keys(ASSET_CATEGORIES) as AssetCategory[]) {
      groups[cat] = [];
    }
    for (const asset of filteredAssets) {
      groups[asset.category].push(asset);
    }
    return groups;
  }, [filteredAssets]);

  const toggleCategory = (category: AssetCategory) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const handleDragStart = (asset: AssetItem, e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify(asset));
    if (onAssetDragStart) {
      onAssetDragStart(asset, e);
    }
  };

  return (
    <div style={CONTAINER}>
      {/* Header with Search */}
      <div style={HEADER}>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <Search size={14} style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--chalk3)',
            pointerEvents: 'none',
          }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            style={SEARCH_INPUT}
          />
        </div>
        <div style={{ fontSize: 10, color: 'var(--chalk3)' }}>
          {filteredAssets.length} asset{filteredAssets.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Asset List */}
      <div style={CONTENT}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--chalk3)' }}>
            Loading assets...
          </div>
        ) : filteredAssets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--chalk3)', fontSize: 12 }}>
            No assets match your search
          </div>
        ) : (
          (Object.keys(ASSET_CATEGORIES) as AssetCategory[]).map(category => {
            const categoryAssets = groupedAssets[category] || [];
            if (categoryAssets.length === 0) return null;

            const isExpanded = expandedCategories.has(category);
            const catConfig = ASSET_CATEGORIES[category];

            return (
              <div key={category} style={CATEGORY_SECTION}>
                <div
                  style={{
                    ...CATEGORY_HEADER,
                    color: catConfig.color,
                  }}
                  onClick={() => toggleCategory(category)}
                >
                  <ChevronDown
                    size={14}
                    style={{
                      transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                      transition: 'transform .15s',
                    }}
                  />
                  <span>{catConfig.icon}</span>
                  <span>{catConfig.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.6 }}>
                    {categoryAssets.length}
                  </span>
                </div>

                {isExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {categoryAssets.map(asset => (
                      <div
                        key={asset.id}
                        draggable
                        onDragStart={(e) => handleDragStart(asset, e)}
                        onClick={() => onAssetSelect?.(asset)}
                        style={{
                          ...ASSET_CARD,
                          borderLeftColor: catConfig.color,
                          borderLeftWidth: 3,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--bg4)';
                          e.currentTarget.style.cursor = 'grab';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--bg3)';
                        }}
                      >
                        <div style={{ fontWeight: 600, color: 'var(--chalk)' }}>
                          {asset.icon} {asset.name}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--chalk3)', marginTop: 2 }}>
                          {asset.code}
                        </div>
                        {asset.description && (
                          <div style={{ fontSize: 10, color: 'var(--chalk3)', marginTop: 4 }}>
                            {asset.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}