// ============================================================
// OPSYN UI — Toast / ToastContainer
// Global toast notification system (driven by ui.store.ts)
// ============================================================

import { useUIStore, type Toast } from '../../store/ui.store';

export function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  if (!toasts.length) return null;

  return (
    <div style={{
      position:       'fixed',
      bottom:         24,
      right:          24,
      zIndex:         999,
      display:        'flex',
      flexDirection:  'column',
      gap:            8,
      pointerEvents:  'none',
    }}>
      {toasts.map((t: Toast) => (
        <div
          key={t.id}
          style={{
            display:     'flex',
            alignItems:  'flex-start',
            gap:         10,
            padding:     '12px 14px',
            borderRadius: 10,
            minWidth:    280,
            maxWidth:    380,
            background:  'var(--bg2)',
            border:      `1px solid ${
              t.type === 'success' ? 'rgba(74,222,128,.3)'  :
              t.type === 'error'   ? 'rgba(248,113,113,.3)' :
              t.type === 'warning' ? 'rgba(251,191,36,.3)'  : 'rgba(34,211,238,.3)'
            }`,
            boxShadow:   'var(--shadow)',
            animation:   'cardIn .22s ease both',
            pointerEvents: 'all',
          }}
        >
          {/* Status dot */}
          <div style={{
            width:        6,
            height:       6,
            borderRadius: '50%',
            flexShrink:   0,
            marginTop:    4,
            background:
              t.type === 'success' ? 'var(--green)'  :
              t.type === 'error'   ? 'var(--rose)'   :
              t.type === 'warning' ? 'var(--amber)'  : 'var(--cyan)',
            boxShadow: `0 0 8px ${
              t.type === 'success' ? 'rgba(74,222,128,.5)'  :
              t.type === 'error'   ? 'rgba(248,113,113,.5)' :
              t.type === 'warning' ? 'rgba(251,191,36,.5)'  : 'rgba(34,211,238,.5)'
            }`,
          }} />

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--chalk)' }}>
              {t.title}
            </div>
            {t.message && (
              <div style={{ fontSize: 11, color: 'var(--chalk3)', marginTop: 2 }}>
                {t.message}
              </div>
            )}
          </div>

          {/* Dismiss */}
          <button
            onClick={() => removeToast(t.id)}
            style={{
              background: 'none',
              border:     'none',
              color:      'var(--chalk3)',
              cursor:     'pointer',
              fontSize:   16,
              padding:    0,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >×</button>
        </div>
      ))}
    </div>
  );
}

// Convenience hook — wraps useUIStore.addToast with typed helpers
export function useToast() {
  const { addToast } = useUIStore();
  return {
    success: (title: string, message?: string) => addToast({ type: 'success', title, message }),
    error:   (title: string, message?: string) => addToast({ type: 'error',   title, message }),
    warning: (title: string, message?: string) => addToast({ type: 'warning', title, message }),
    info:    (title: string, message?: string) => addToast({ type: 'info',    title, message }),
  };
}

// Keep default export for backwards compatibility with existing AppShell import
export default ToastContainer;
