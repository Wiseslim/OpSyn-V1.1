// ============================================================
// OPSYN TOPBAR — src/layouts/Topbar.tsx   (Stage 2)
// grid-area: topbar  |  height: var(--topbar-height)  |  56px
// Left: page title + breadcrumb
// Right: Search · Notification bell + badge · Profile dropdown + role badge
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { usePermissions } from '../hooks/usePermissions';

interface TopbarProps {
  title:       string;
  crumb:       string;
  unreadCount: number;
}

// ── Role badge colour by role name ─────────────────────────────
function roleBgColor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('admin'))   return 'var(--color-teal)';
  if (n.includes('manager')) return 'var(--color-amber)';
  if (n.includes('noc'))     return 'var(--color-indigo)';
  if (n.includes('field'))   return 'var(--color-green)';
  return 'var(--color-text-muted)';
}

// ── Minimal SVG icons (20×20) ──────────────────────────────────
function SearchIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none"
         stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
      <circle cx="9" cy="9" r="6" />
      <path d="M14 14L18 18" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none"
         stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2a6 6 0 00-6 6v2.5L2.5 13h15L16 10.5V8a6 6 0 00-6-6z" />
      <path d="M8 16a2 2 0 004 0" />
    </svg>
  );
}
function ChevronDown() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none"
         stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
      <path d="M3 5l4 4 4-4" />
    </svg>
  );
}

// ── Shared icon button styles ──────────────────────────────────
const iconBtn: React.CSSProperties = {
  background:    'none',
  border:        'none',
  cursor:        'pointer',
  padding:       4,
  borderRadius:  6,
  display:       'flex',
  alignItems:    'center',
  justifyContent:'center',
  color:         'rgba(255,255,255,0.55)',
  transition:    'color 150ms, background 150ms',
};

// ══ TOPBAR ════════════════════════════════════════════════════
export default function Topbar({ title, crumb, unreadCount }: TopbarProps) {
  const navigate   = useNavigate();
  const { user }   = useAuthStore();
  const clearAuth  = useAuthStore(s => s.clearAuth);
  const { userName, userInitials, isAdmin } = usePermissions();

  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const roleName = user?.role?.name ?? '';

  // Close on outside click
  useEffect(() => {
    if (!profileOpen) return;
    function onDoc(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [profileOpen]);

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <header
      style={{
        gridArea:       'topbar',
        height:         'var(--topbar-height)',
        background:     'var(--color-navy)',
        borderBottom:   '1px solid rgba(255,255,255,0.08)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '0 24px',
        position:       'relative',
        zIndex:         30,
      }}
    >
      {/* Left ─ page title + breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{
          fontFamily:    'var(--font-display)',
          fontSize:      16,
          fontWeight:    600,
          color:         'white',
          letterSpacing: '-0.01em',
        }}>
          {title}
        </span>
        {crumb && (
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   13,
            color:      'var(--color-text-muted)',
          }}>
            {crumb}
          </span>
        )}
      </div>

      {/* Right ─ search · bell · profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>

        {/* Search */}
        <button
          aria-label="Search"
          style={iconBtn}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = 'white';
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)';
            (e.currentTarget as HTMLElement).style.background = 'none';
          }}
        >
          <SearchIcon />
        </button>

        {/* Notification bell */}
        <button
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          onClick={() => navigate('/notifications')}
          style={{
            ...iconBtn,
            position: 'relative',
            color: unreadCount > 0 ? 'var(--color-teal)' : 'rgba(255,255,255,0.55)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'none';
          }}
        >
          <BellIcon />
          {unreadCount > 0 && (
            <span aria-hidden="true" style={{
              position:       'absolute',
              top:            0,
              right:          0,
              minWidth:       16,
              height:         16,
              borderRadius:   8,
              background:     'var(--color-teal)',
              color:          'var(--color-navy)',
              fontSize:       10,
              fontWeight:     700,
              fontFamily:     'var(--font-display)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              padding:        '0 3px',
              lineHeight:     1,
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Profile dropdown */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            aria-label="Open profile menu"
            aria-haspopup="true"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen(p => !p)}
            style={{
              display:        'flex',
              alignItems:     'center',
              gap:            8,
              background:     profileOpen ? 'rgba(255,255,255,0.06)' : 'none',
              border:         'none',
              cursor:         'pointer',
              padding:        '4px 6px',
              borderRadius:   8,
              transition:     'background 150ms',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { if (!profileOpen) (e.currentTarget as HTMLElement).style.background = 'none'; }}
          >
            {/* Avatar */}
            <div style={{
              width:          32,
              height:         32,
              borderRadius:   '50%',
              background:     'var(--color-teal)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              fontSize:       13,
              fontWeight:     700,
              color:          'var(--color-navy)',
              fontFamily:     'var(--font-display)',
              flexShrink:     0,
            }}>
              {userInitials}
            </div>

            {/* Name */}
            <span style={{
              fontSize:      13,
              fontWeight:    500,
              color:         'white',
              fontFamily:    'var(--font-display)',
              maxWidth:      120,
              overflow:      'hidden',
              textOverflow:  'ellipsis',
              whiteSpace:    'nowrap',
            }}>
              {userName || 'Opsyn User'}
            </span>

            {/* Role badge — always visible per spec */}
            {roleName && (
              <span aria-label={`Role: ${roleName}`} style={{
                display:        'inline-flex',
                alignItems:     'center',
                padding:        '2px 7px',
                borderRadius:   'var(--radius-badge)',
                background:     roleBgColor(roleName),
                color:          'white',
                fontSize:       10,
                fontWeight:     700,
                fontFamily:     'var(--font-display)',
                letterSpacing:  '0.04em',
                textTransform:  'uppercase',
                flexShrink:     0,
              }}>
                {roleName}
              </span>
            )}

            <ChevronDown />
          </button>

          {/* Dropdown menu */}
          {profileOpen && (
            <div
              role="menu"
              aria-label="Profile menu"
              style={{
                position:     'absolute',
                top:          'calc(100% + 8px)',
                right:        0,
                minWidth:     200,
                background:   'var(--color-navy-light)',
                border:       '1px solid var(--color-border)',
                borderRadius: 'var(--radius-card)',
                boxShadow:    'var(--shadow-panel)',
                overflow:     'hidden',
                zIndex:       200,
                animation:    'fadeUp 150ms ease both',
              }}
            >
              {([
                { label: 'My Profile',    action: () => { navigate('/staff'); setProfileOpen(false); } },
                ...(isAdmin ? [{ label: 'Switch Tenant', action: () => setProfileOpen(false) }] : []),
                { label: 'Settings',      action: () => { navigate('/settings'); setProfileOpen(false); } },
                { label: 'Logout',        action: handleLogout, danger: true },
              ] as { label: string; action: () => void; danger?: boolean }[]).map(item => (
                <button
                  key={item.label}
                  role="menuitem"
                  onClick={item.action}
                  style={{
                    display:    'block',
                    width:      '100%',
                    padding:    '10px 16px',
                    background: 'none',
                    border:     'none',
                    textAlign:  'left',
                    fontSize:   14,
                    fontFamily: 'var(--font-body)',
                    color:      item.danger ? 'var(--color-red)' : 'var(--color-text-primary)',
                    cursor:     'pointer',
                    transition: 'background 150ms',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,194,168,0.06)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
