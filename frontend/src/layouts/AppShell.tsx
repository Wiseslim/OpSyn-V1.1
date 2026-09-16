// ============================================================
// OPSYN APP SHELL — src/layouts/AppShell.tsx   (Stage 2 rebuild)
// CSS Grid orchestrator:
//   grid-areas: rail | topbar | intelstrip | content
// Children:
//   PrimaryRail  — 64px icon rail, hover-triggers flyout
//   Topbar       — 56px topbar, page title + profile dropdown
//   FlyoutDrawer — glassmorphism overlay, never pushes content
//   IntelStrip   — 40px live KPI bar
//   <Outlet />   — page content
// ============================================================

import { useRef, useState, useCallback, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { notificationsApi, onboardingApi } from '../api/index';
import ToastContainer                       from '../components/ui/Toast';
import PrimaryRail, { type CategoryKey }    from './PrimaryRail';
import Topbar                               from './Topbar';
import FlyoutDrawer                         from './FlyoutDrawer';
import IntelStrip                           from './IntelStrip';
import { type SidebarKey }                  from '../store/ui.store';

// ── Route metadata ─────────────────────────────────────────────
// Maps the first path segment → { title, crumb, sbKey }
const ROUTE_META: Record<string, { title: string; crumb: string; sbKey: SidebarKey }> = {
  dashboard:            { title: 'Command Center',         crumb: '/ Overview',       sbKey: 'dashboard' },
  tasks:                { title: 'Task Board',             crumb: '/ All Tasks',      sbKey: 'tasks'     },
  projects:             { title: 'Project Monitor',        crumb: '/ Active',         sbKey: 'tasks'     },
  outage:               { title: 'Outage Monitor',         crumb: '/ Live Incidents', sbKey: 'tasks'     },
  staff:                { title: 'Personnel Directory',    crumb: '/ All Staff',      sbKey: 'staff'     },
  onboarding:           { title: 'Onboarding',             crumb: '/ Requests',       sbKey: 'staff'     },
  roles:                { title: 'Roles & Permissions',    crumb: '/ Access Matrix',  sbKey: 'staff'     },
  reports:              { title: 'Intelligence Reports',   crumb: '/ Analytics',      sbKey: 'intel'     },
  audit:                { title: 'Audit Logs',             crumb: '/ All Events',     sbKey: 'intel'     },
  notifications:        { title: 'Notifications',          crumb: '/ Inbox',          sbKey: 'dashboard' },
  org:                  { title: 'Workflow Builder',       crumb: '/ Dept Routing',   sbKey: 'staff'     },
  infrastructure:       { title: 'Network Infrastructure', crumb: '/ Asset Registry', sbKey: 'intel'     },
  settings:             { title: 'Settings',               crumb: '/ Admin Panel',    sbKey: 'settings'  },
  activity:             { title: 'Activity Feed',          crumb: '/ Timeline',       sbKey: 'intel'     },
  shifts:               { title: 'NOC Shift Scheduler',   crumb: '/ Weekly Grid',    sbKey: 'tasks'     },
  customers:            { title: 'Customers',              crumb: '/ All Customers',  sbKey: 'tasks'     },
};

// ══ APP SHELL ═════════════════════════════════════════════════
export default function AppShell() {
  const { pathname } = useLocation();

  // ── Drawer / category state ───────────────────────────────────
  const [activeCategory, setActiveCategory] = useState<CategoryKey | null>(null);
  const openTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Live badge counts ────────────────────────────────────────
  const { data: unreadCount = 0 } = useQuery({
    queryKey:        ['notifications', 'unread-count'],
    queryFn:         () => notificationsApi.getUnreadCount(),
    refetchInterval: 30_000,
  });

  const { data: onboardingData } = useQuery({
    queryKey:        ['onboarding', 'pending-count'],
    queryFn:         () => onboardingApi.list({ status: 'pending' }),
    refetchInterval: 60_000,
  });
  const pendingOnboard: number =
    (onboardingData as any)?.items?.length ??
    (Array.isArray(onboardingData) ? (onboardingData as any[]).length : 0);

  // ── Route metadata ───────────────────────────────────────────
  const routeKey = pathname.slice(1).split('/')[0] || 'dashboard';
  const meta = ROUTE_META[routeKey] ?? ROUTE_META.dashboard;

  // ── Drawer timer helpers ─────────────────────────────────────
  const scheduleOpenCategory = useCallback((cat: CategoryKey) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = setTimeout(() => setActiveCategory(cat), 120);
  }, []);

  const scheduleClose = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    closeTimer.current = setTimeout(() => setActiveCategory(null), 280);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  // Clean up timers on unmount
  useEffect(() => () => {
    if (openTimer.current)  clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  // Close drawer when route changes
  useEffect(() => {
    setActiveCategory(null);
  }, [pathname]);

  // Map page needs deeper blur on flyout per spec (Stage 4 refinement entry-point)
  const isOnMap = pathname.startsWith('/infrastructure');

  const drawerOpen = activeCategory !== null;

  return (
    // .drawer-open class hides rail CSS tooltips while flyout is visible
    <div
      className={`app-shell${drawerOpen ? ' drawer-open' : ''}`}
      style={{ position: 'relative' }}
    >
      {/* ── grid-area: rail ── */}
      <PrimaryRail
        activeCategory={activeCategory}
        onHoverCategory={scheduleOpenCategory}
        onLeaveRail={scheduleClose}
      />

      {/* ── grid-area: topbar ── */}
      <Topbar
        title={meta.title}
        crumb={meta.crumb}
        unreadCount={unreadCount}
      />

      {/* ── Flyout drawer — position: absolute, never in grid flow ── */}
      <FlyoutDrawer
        activeCategory={activeCategory}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        unreadCount={unreadCount}
        pendingOnboard={pendingOnboard}
        isOnMap={isOnMap}
      />

      {/* ── grid-area: intelstrip ── */}
      <IntelStrip />

      {/* ── grid-area: content ── */}
      <main
        style={{
          gridArea:  'content',
          overflow:  'hidden',
          display:   'flex',
          flexDirection: 'column',
          minWidth:  0,
          minHeight: 0,
          background: 'var(--color-surface)',
        }}
      >
        <Outlet />
      </main>

      {/* Toast overlay — fixed, outside grid flow */}
      <ToastContainer />
    </div>
  );
}
