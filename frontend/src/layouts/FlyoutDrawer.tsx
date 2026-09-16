// ============================================================
// OPSYN FLYOUT DRAWER — src/layouts/FlyoutDrawer.tsx
// Category-scoped glassmorphism overlay navigation panel.
// position: absolute, left: var(--rail-width), never pushes content.
// pointer-events: none when closed — eliminates invisible click-blocking.
// Open delay: 120ms | Close delay: 280ms (managed by AppShell)
// ============================================================

import { useLocation, useNavigate } from 'react-router-dom';
import { type CategoryKey } from './PrimaryRail';

interface FlyoutDrawerProps {
  activeCategory: CategoryKey | null;
  onMouseEnter:   () => void;
  onMouseLeave:   () => void;
  unreadCount:    number;
  pendingOnboard: number;
  isOnMap?:       boolean;
}

// ── Type definitions ──────────────────────────────────────────
type NavItem = {
  label:    string;
  path:     string;
  icon:     string;
  tag?:     string;
  badgeKey?: 'unread' | 'onboard';
};
type NavGroup = { title: string; items: NavItem[] };
type CategoryDef = {
  key:      CategoryKey;
  title:    string;
  subtitle: string;
  groups:   NavGroup[];
};

// ── Category content definitions ──────────────────────────────
const CATEGORY_DEFS: Record<CategoryKey, CategoryDef> = {
  ops: {
    key:      'ops',
    title:    'Operational',
    subtitle: 'Live ops, tasks & network',
    groups: [
      {
        title: 'Core',
        items: [
          { label: 'Command Center',  path: '/dashboard',      icon: 'grid'    },
          { label: 'Tasks',           path: '/tasks',          icon: 'tasks'   },
          { label: 'Projects',        path: '/projects',       icon: 'folder'  },
        ],
      },
      {
        title: 'Network',
        items: [
          { label: 'Active Outages',  path: '/outage',         icon: 'warn'    },
          { label: 'Infrastructure',  path: '/infrastructure', icon: 'network' },
          { label: 'NOC Shifts',      path: '/shifts',         icon: 'cal'     },
        ],
      },
      {
        title: 'Customers',
        items: [
          { label: 'Customers',       path: '/customers',      icon: 'person'  },
          { label: 'Field Schemas',   path: '/customers/forms', icon: 'forms'  },
        ],
      },
      {
        title: 'Visibility',
        items: [
          { label: 'Activity Feed',   path: '/activity',       icon: 'chart'   },
        ],
      },
    ],
  },

  mgt: {
    key:      'mgt',
    title:    'Management',
    subtitle: 'People, access & intelligence',
    groups: [
      {
        title: 'People',
        items: [
          { label: 'Staff Directory',  path: '/staff',      icon: 'users'               },
          { label: 'Onboarding',       path: '/onboarding', icon: 'plus', badgeKey: 'onboard' },
          { label: 'Roles & Access',   path: '/roles',      icon: 'star'                },
          { label: 'Departments',      path: '/org',        icon: 'org'                 },
        ],
      },
      {
        title: 'Intelligence',
        items: [
          { label: 'Reports',          path: '/reports',    icon: 'bar'  },
          { label: 'Audit Logs',       path: '/audit',      icon: 'log'  },
        ],
      },
    ],
  },

  int: {
    key:      'int',
    title:    'Intelligence',
    subtitle: 'Analytics, reports & insights',
    groups: [
      {
        title: 'Reports',
        items: [
          { label: 'Reports Hub',        path: '/reports',        icon: 'bar'     },
          { label: 'Audit Trail',        path: '/audit',          icon: 'log'     },
          { label: 'Infrastructure Map', path: '/infrastructure', icon: 'network' },
        ],
      },
      {
        title: 'Analytics',
        items: [
          { label: 'MTTR Analytics',   path: '/reports', icon: 'trend', tag: 'Beta' },
          { label: 'AI Insights',      path: '/reports', icon: 'ai',    tag: 'Soon' },
          { label: 'Trend Analysis',   path: '/reports', icon: 'chart', tag: 'Soon' },
        ],
      },
    ],
  },

  sys: {
    key:      'sys',
    title:    'System',
    subtitle: 'Settings, integrations & security',
    groups: [
      {
        title: 'Configuration',
        items: [
          { label: 'Settings',             path: '/settings',                       icon: 'gear'  },
          { label: 'Form Builder',         path: '/form-builder',                   icon: 'forms' },
          { label: 'Integrations',         path: '/settings?tab=integrations',      icon: 'plug'  },
          { label: 'Webhooks',             path: '/settings?tab=webhooks',          icon: 'hook'  },
          { label: 'Pipeline Templates',   path: '/settings?tab=pipelines',         icon: 'flow'  },
        ],
      },
      {
        title: 'Security',
        items: [
          { label: 'Roles & Permissions',  path: '/roles',                          icon: 'star' },
          { label: 'Notification Rules',   path: '/settings?tab=notification-rules', icon: 'bell' },
        ],
      },
    ],
  },

  hlp: {
    key:      'hlp',
    title:    'Help',
    subtitle: 'Documentation & support',
    groups: [
      {
        title: 'Resources',
        items: [
          { label: 'Documentation',   path: '', icon: 'book', tag: 'Soon' },
          { label: 'Tutorials',       path: '', icon: 'play', tag: 'Soon' },
          { label: 'FAQ',             path: '', icon: 'faq',  tag: 'Soon' },
        ],
      },
      {
        title: 'Support',
        items: [
          { label: 'Support Center',  path: '', icon: 'chat', tag: 'Soon' },
          { label: 'Release Notes',   path: '', icon: 'news', tag: 'Soon' },
        ],
      },
    ],
  },
};

// ── SVG icon library (16×16 viewBox, stroke-based) ────────────
const PATHS: Record<string, string> = {
  grid:    'M2 2h5v5H2zm7 0h5v5H9zm-7 7h5v5H2zm7 0h5v5H9z',
  tasks:   'M3 4h10M3 8h10M3 12h7',
  folder:  'M2 4h4l2-2h6v10H2z',
  warn:    'M8 1L1 13h14L8 1zm0 4v4m0 2.5h.01',
  network: 'M8 1a2 2 0 100 4 2 2 0 000-4zM2 9a2 2 0 100 4 2 2 0 000-4zm12 0a2 2 0 100 4 2 2 0 000-4zM8 5v2M5 10l-2 3M11 10l2 3',
  cal:     'M1 4h14v10H1zm4-3v3m6-3v3M1 8h14',
  chart:   'M2 12h3v2H2zm4-4h3v6H6zm4-4h3v10h-3z',
  plus:    'M8 2v12M2 8h12',
  users:   'M5 7a3 3 0 100-6 3 3 0 000 6zm-4 7c0-3.3 1.8-6 4-6s4 2.7 4 6m3-11a2.5 2.5 0 110 5m2 6c0-2.2-1-4-2.5-4',
  star:    'M8 1l2 5h5l-4 3 1.5 5L8 12l-4.5 2.5L5 9 1 6h5z',
  org:     'M8 2v4M5 6v4h3v4M8 10h3V6',
  bar:     'M2 11h3v3H2zm4-4h3v7H6zm4-4h3v11h-3z',
  log:     'M2 3h12v2H2zm0 4h12v2H2zm0 4h8v2H2z',
  gear:    'M8 5a3 3 0 100 6 3 3 0 000-6zm0-3v2m0 8v2M4.2 4.2l1.4 1.4m5 5l1.4 1.4M2 8h2m8 0h2M4.2 11.8l1.4-1.4m5-5l1.4-1.4',
  plug:    'M6 2v4h4V2M5 6v4a3 3 0 006 0V6M8 10v4',
  hook:    'M4 8c0-2.2 1.8-4 4-4s4 1.8 4 4v5m-4-9V2',
  flow:    'M2 8h4V5h4v3h4M6 5V3h4v2',
  bell:    'M4 10V7a4 4 0 018 0v3l1.5 2h-11zm4 2a2 2 0 004 0',
  book:    'M2 2h9l3 3v11H2zm3 8h6M5 8h6M5 6h3',
  play:    'M3 2l12 6-12 6z',
  faq:     'M6 6.5a2 2 0 114 0c0 1.5-2 1.5-2 3m.01 3h-.01',
  chat:    'M2 2h12v9H9l-3 3V11H2z',
  news:    'M2 2h12v12H2zm2 3h8M4 7h8M4 9h5',
  ai:      'M8 3a5 5 0 100 10A5 5 0 008 3zm0 2v2l2 2',
  trend:   'M2 12l4-4 3 2 5-6',
  person:  'M8 7a3 3 0 100-6 3 3 0 000 6zm-5 7c0-2.8 2.2-5 5-5s5 2.2 5 5',
  forms:   'M3 2h10v12H3zm2 3h6M5 7h6M5 10h4',
};

function NavIcon({ name }: { name: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none"
         stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.tasks} />
    </svg>
  );
}

// ══ FLYOUT DRAWER ════════════════════════════════════════════
export default function FlyoutDrawer({
  activeCategory, onMouseEnter, onMouseLeave,
  unreadCount, pendingOnboard, isOnMap = false,
}: FlyoutDrawerProps) {
  const navigate     = useNavigate();
  const { pathname } = useLocation();

  const open = activeCategory !== null;
  const def  = activeCategory ? CATEGORY_DEFS[activeCategory] : null;

  const blur = isOnMap ? '16px' : '12px';
  const bg   = isOnMap ? 'rgba(30,41,59,0.96)' : 'rgba(30,41,59,0.92)';

  const isActive = (path: string) =>
    path === '/dashboard'
      ? pathname === path
      : path !== '' && (pathname === path || pathname.startsWith(path.split('?')[0]));

  const badgeFor = (key?: 'unread' | 'onboard'): string | undefined => {
    if (!key) return undefined;
    if (key === 'unread'  && unreadCount    > 0) return String(unreadCount);
    if (key === 'onboard' && pendingOnboard > 0) return String(pendingOnboard);
    return undefined;
  };

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-hidden={!open}
      style={{
        position:       'absolute',
        left:           'var(--rail-width)',
        top:            0,
        height:         '100%',
        width:          'var(--drawer-width)',
        background:     bg,
        backdropFilter: `blur(${blur})`,
        WebkitBackdropFilter: `blur(${blur})`,
        borderRight:    '1px solid rgba(255,255,255,0.10)',
        zIndex:         40,
        overflowY:      'auto',
        overflowX:      'hidden',
        scrollbarWidth: 'none',
        transform:      open ? 'translateX(0)' : 'translateX(-100%)',
        transition:     'transform var(--transition-nav)',
        boxShadow:      open ? 'var(--shadow-panel)' : 'none',
        pointerEvents:  open ? 'auto' : 'none',
      }}
    >
      {def && (
        <>
          {/* Category header */}
          <div style={{ padding: '20px 16px 12px' }}>
            <div style={{
              fontSize:      13,
              fontWeight:    800,
              fontFamily:    'var(--font-display)',
              color:         'white',
              letterSpacing: '-0.02em',
              marginBottom:  2,
            }}>
              {def.title}
            </div>
            <div style={{
              fontSize:   11,
              color:      'rgba(255,255,255,0.45)',
              fontFamily: 'var(--font-display)',
            }}>
              {def.subtitle}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 8 }} />

          {/* Nav groups */}
          {def.groups.map(group => (
            <div key={group.title} style={{ marginBottom: 8 }}>
              <div style={{
                padding:       '4px 16px 6px',
                fontSize:      10,
                fontWeight:    700,
                fontFamily:    'var(--font-display)',
                color:         'rgba(255,255,255,0.35)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase' as const,
              }}>
                {group.title}
              </div>

              {group.items.map(item => {
                const active = isActive(item.path);
                const badge  = badgeFor(item.badgeKey);
                return (
                  <DrawerItem
                    key={item.label}
                    label={item.label}
                    icon={item.icon}
                    active={active}
                    badge={badge}
                    tag={item.tag}
                    disabled={item.path === ''}
                    onClick={() => item.path && navigate(item.path)}
                  />
                );
              })}
            </div>
          ))}

          <div style={{ height: 20 }} />
        </>
      )}
    </div>
  );
}

// ── Drawer nav item ────────────────────────────────────────────
function DrawerItem({ label, icon, active, badge, tag, disabled, onClick }: {
  label:    string;
  icon:     string;
  active:   boolean;
  badge?:   string;
  tag?:     string;
  disabled: boolean;
  onClick:  () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? 'page' : undefined}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            10,
        width:          '100%',
        height:         34,
        padding:        '0 16px',
        border:         'none',
        cursor:         disabled ? 'default' : 'pointer',
        textAlign:      'left',
        fontFamily:     'var(--font-display)',
        fontSize:       13,
        fontWeight:     active ? 600 : 400,
        color:          disabled ? 'rgba(255,255,255,0.30)' : active ? 'white' : 'rgba(255,255,255,0.68)',
        background:     active ? 'rgba(0,194,168,0.15)' : 'transparent',
        boxShadow:      active ? 'inset 3px 0 0 var(--color-teal)' : 'none',
        transition:     'background 120ms, color 120ms',
        position:       'relative',
        opacity:        disabled ? 0.6 : 1,
      }}
      onMouseEnter={e => {
        if (!active && !disabled) {
          (e.currentTarget as HTMLElement).style.background = 'rgba(0,194,168,0.09)';
          (e.currentTarget as HTMLElement).style.color      = 'white';
        }
      }}
      onMouseLeave={e => {
        if (!active && !disabled) {
          (e.currentTarget as HTMLElement).style.background = 'transparent';
          (e.currentTarget as HTMLElement).style.color      = 'rgba(255,255,255,0.68)';
        }
      }}
    >
      <NavIcon name={icon} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {badge && (
        <span style={{
          minWidth: 18, height: 18, borderRadius: 9,
          background:     'var(--color-teal)',
          color:          'var(--color-navy)',
          fontSize:       10, fontWeight: 700,
          fontFamily:     'var(--font-display)',
          display:        'flex', alignItems: 'center', justifyContent: 'center',
          padding:        '0 4px', flexShrink: 0,
        }}>
          {badge}
        </span>
      )}
      {tag && (
        <span style={{
          padding:      '1px 6px', borderRadius: 4,
          fontSize:     9, fontWeight: 700,
          fontFamily:   'var(--font-display)',
          background:   tag === 'Beta' ? 'rgba(0,194,168,0.20)' : 'rgba(255,255,255,0.10)',
          color:        tag === 'Beta' ? 'var(--color-teal)'     : 'rgba(255,255,255,0.45)',
          letterSpacing:'0.04em', flexShrink: 0,
        }}>
          {tag}
        </span>
      )}
    </button>
  );
}
