// ============================================================
// OPSYN PRIMARY RAIL — src/layouts/PrimaryRail.tsx
// Enterprise grouped navigation: 5 category buttons (OPS/MGT/INT/SYS/HLP)
// 64px wide, dark navy. Hover opens category-scoped FlyoutDrawer.
// Active highlight if current route belongs to category, or drawer open for it.
// Open delay: 120ms | Close grace: 280ms (managed by AppShell)
// ============================================================

import { useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import OpsynMark from '../components/brand/OpsynMark';

export type CategoryKey = 'ops' | 'mgt' | 'int' | 'sys' | 'hlp';

interface PrimaryRailProps {
  activeCategory:  CategoryKey | null;
  onHoverCategory: (cat: CategoryKey) => void;
  onLeaveRail:     () => void;
}

// Route-to-category membership map (first path segment)
const CATEGORY_ROUTES: Record<CategoryKey, string[]> = {
  ops: ['/dashboard', '/tasks', '/projects', '/outage', '/infrastructure', '/shifts', '/activity'],
  mgt: ['/staff', '/onboarding', '/roles', '/org', '/reports', '/audit'],
  int: ['/reports', '/audit', '/infrastructure'],
  sys: ['/settings', '/roles', '/form-builder'],
  hlp: [],
};

// Category definitions
const CATEGORIES: { key: CategoryKey; label: string; abbrev: string; iconPath: string }[] = [
  {
    key:      'ops',
    label:    'Operational',
    abbrev:   'OPS',
    iconPath: 'M8 1l3 5H5l3 6m-2-4h4',
  },
  {
    key:      'mgt',
    label:    'Management',
    abbrev:   'MGT',
    iconPath: 'M5 7a3 3 0 100-6 3 3 0 000 6zm-4 7c0-3.3 1.8-6 4-6h5m0-3a2.5 2.5 0 110 5m2 6c0-2.2-1-4-2.5-4',
  },
  {
    key:      'int',
    label:    'Intelligence',
    abbrev:   'INT',
    iconPath: 'M3 12V8m3 4V5m3 7V3m3 9V6',
  },
  {
    key:      'sys',
    label:    'System',
    abbrev:   'SYS',
    iconPath: 'M8 5a3 3 0 100 6 3 3 0 000-6zm0-3v2m0 8v2M4.2 4.2l1.4 1.4m5 5l1.4 1.4M2 8h2m9 0h2M4.2 11.8l1.4-1.4m5-5l1.4-1.4',
  },
  {
    key:      'hlp',
    label:    'Help',
    abbrev:   'HLP',
    iconPath: 'M6 6.5a2 2 0 114 0c0 1.5-2 1.5-2 3m.01 3h-.01',
  },
];

// ══ PRIMARY RAIL ══════════════════════════════════════════════
export default function PrimaryRail({ activeCategory, onHoverCategory, onLeaveRail }: PrimaryRailProps) {
  const navigate     = useNavigate();
  const { pathname } = useLocation();

  const categoryOf = (pathname: string): CategoryKey | null => {
    const seg = '/' + pathname.slice(1).split('/')[0];
    for (const [cat, routes] of Object.entries(CATEGORY_ROUTES) as [CategoryKey, string[]][]) {
      if (routes.some(r => seg === r || (r !== '/' && pathname.startsWith(r)))) return cat;
    }
    return null;
  };

  const currentCategory = categoryOf(pathname);

  return (
    <nav
      aria-label="Primary category rail"
      onMouseLeave={onLeaveRail}
      style={{
        gridArea:       'rail',
        width:          'var(--rail-width)',
        background:     'var(--color-navy)',
        borderRight:    '1px solid rgba(255,255,255,0.06)',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        padding:        '16px 0',
        position:       'relative',
        zIndex:         50,
      }}
    >
      {/* Logo mark */}
      <button
        aria-label="Go to Dashboard"
        onClick={() => navigate('/dashboard')}
        style={{
          background:     'none',
          border:         'none',
          cursor:         'pointer',
          padding:        0,
          marginBottom:   12,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          borderRadius:   8,
        }}
      >
        <OpsynMark size={36} />
      </button>

      {/* Divider */}
      <div aria-hidden="true" style={{
        width: 32, height: 1,
        background:   'rgba(255,255,255,0.10)',
        marginBottom: 12,
        flexShrink:   0,
      }} />

      {/* Category buttons */}
      {CATEGORIES.map(cat => {
        const isActive  = activeCategory === cat.key || (activeCategory === null && currentCategory === cat.key);
        const isCurrent = currentCategory === cat.key;
        return (
          <CategoryButton
            key={cat.key}
            label={cat.label}
            abbrev={cat.abbrev}
            iconPath={cat.iconPath}
            active={isActive}
            routeActive={isCurrent}
            onMouseEnter={() => onHoverCategory(cat.key)}
          />
        );
      })}

      {/* Help pinned at bottom */}
      <div style={{ marginTop: 'auto', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div aria-hidden="true" style={{
          width: 32, height: 1,
          background:  'rgba(255,255,255,0.10)',
          marginBottom: 8,
        }} />
      </div>
    </nav>
  );
}

// ── Category button ────────────────────────────────────────────
function CategoryButton({
  label, abbrev, iconPath, active, routeActive, onMouseEnter,
}: {
  label:        string;
  abbrev:       string;
  iconPath:     string;
  active:       boolean;
  routeActive:  boolean;
  onMouseEnter: () => void;
}) {
  const highlight = active || routeActive;
  return (
    <div
      className="rail-item-wrapper"
      style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', marginBottom: 2 }}
    >
      <button
        aria-label={label}
        onMouseEnter={onMouseEnter}
        style={{
          width:          48,
          height:         48,
          borderRadius:   10,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            3,
          cursor:         'pointer',
          border:         'none',
          outline:        'none',
          background:     highlight ? 'rgba(0,194,168,0.14)' : 'transparent',
          color:          highlight ? 'var(--color-teal)' : 'rgba(255,255,255,0.50)',
          boxShadow:      highlight ? 'inset 3px 0 0 var(--color-teal)' : 'none',
          transition:     'background 140ms, color 140ms',
        }}
        onMouseLeave={e => {
          if (!highlight) {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color      = 'rgba(255,255,255,0.50)';
          }
        }}
        onFocus={e => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(0,194,168,0.10)';
          (e.currentTarget as HTMLElement).style.color      = 'rgba(255,255,255,0.85)';
        }}
        onBlur={e => {
          if (!highlight) {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color      = 'rgba(255,255,255,0.50)';
          }
        }}
      >
        {/* Category icon */}
        <svg width={18} height={18} viewBox="0 0 16 16" fill="none"
             stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
             aria-hidden="true">
          <path d={iconPath} />
        </svg>
        {/* Abbreviated label */}
        <span style={{
          fontSize:      7.5,
          fontWeight:    700,
          fontFamily:    'var(--font-display)',
          letterSpacing: '0.06em',
          lineHeight:    1,
        }}>
          {abbrev}
        </span>
      </button>

      {/* CSS tooltip — full category name */}
      <span
        aria-hidden="true"
        className="rail-tooltip"
        style={{
          position:     'absolute',
          left:         'calc(var(--rail-width) + 8px)',
          top:          '50%',
          transform:    'translateY(-50%)',
          background:   'var(--color-navy-light)',
          color:        'white',
          fontSize:     12,
          fontFamily:   'var(--font-display)',
          fontWeight:   500,
          padding:      '4px 10px',
          borderRadius: 6,
          whiteSpace:   'nowrap',
          boxShadow:    'var(--shadow-panel)',
          border:       '1px solid rgba(255,255,255,0.10)',
          pointerEvents:'none',
          zIndex:       100,
        }}
      >
        {label}
      </span>
    </div>
  );
}
