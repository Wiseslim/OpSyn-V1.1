// ============================================================
// OPSYN UI — Pagination  (Stage 3 rebuild)
// Design tokens: --color-teal, --color-border, --color-surface-2,
//                --color-text-primary, --color-text-muted, --font-display
// ============================================================

import React from 'react';

export interface PaginationProps {
  page:        number;
  pageSize:    number;
  total:       number;
  onPage:      (page: number) => void;
  onPageSize?: (size: number) => void;
  pageSizes?:  number[];
  style?:      React.CSSProperties;
}

const BTN_BASE: React.CSSProperties = {
  display:        'inline-flex',
  alignItems:     'center',
  justifyContent: 'center',
  width:          30,
  height:         30,
  borderRadius:   6,
  border:         '1px solid var(--color-border)',
  background:     'white',
  color:          'var(--color-text-primary)',
  fontSize:       12,
  fontWeight:     600,
  fontFamily:     'var(--font-display)',
  cursor:         'pointer',
  transition:     'background 120ms, border-color 120ms, color 120ms',
  flexShrink:     0,
};

// ══ PAGINATION ════════════════════════════════════════════════
export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  pageSizes = [10, 20, 50, 100],
  style,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from       = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to         = Math.min(page * pageSize, total);

  const pages = buildPageList(page, totalPages);

  return (
    <div style={{
      display:    'flex',
      alignItems: 'center',
      gap:        6,
      flexWrap:   'wrap',
      ...style,
    }}>
      {/* Item count */}
      <span style={{
        fontSize:   12,
        fontFamily: 'var(--font-body)',
        color:      'var(--color-text-muted)',
        marginRight: 4,
      }}>
        {total === 0 ? 'No results' : `${from}–${to} of ${total}`}
      </span>

      {/* Per-page selector */}
      {onPageSize && (
        <select
          value={pageSize}
          onChange={e => { onPageSize(Number(e.target.value)); onPage(1); }}
          style={{
            height:       30,
            background:   'white',
            border:       '1px solid var(--color-border)',
            borderRadius: 6,
            padding:      '0 6px',
            color:        'var(--color-text-primary)',
            fontSize:     12,
            fontFamily:   'var(--font-display)',
            cursor:       'pointer',
            outline:      'none',
          }}
        >
          {pageSizes.map(s => (
            <option key={s} value={s}>{s} / page</option>
          ))}
        </select>
      )}

      {/* Previous */}
      <button
        style={{ ...BTN_BASE, opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        aria-label="Previous page"
      >
        ‹
      </button>

      {/* Page numbers */}
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} style={{
            color:     'var(--color-text-muted)',
            fontSize:  12,
            padding:   '0 4px',
          }}>…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p as number)}
            aria-current={p === page ? 'page' : undefined}
            style={{
              ...BTN_BASE,
              background:   p === page ? 'var(--color-teal)' : 'white',
              color:        p === page ? 'var(--color-navy)' : 'var(--color-text-primary)',
              borderColor:  p === page ? 'var(--color-teal)' : 'var(--color-border)',
              fontWeight:   p === page ? 700 : 600,
            }}
            onMouseEnter={e => {
              if (p !== page) {
                (e.currentTarget as HTMLElement).style.background    = 'var(--color-surface-2)';
                (e.currentTarget as HTMLElement).style.borderColor   = 'var(--color-teal)';
              }
            }}
            onMouseLeave={e => {
              if (p !== page) {
                (e.currentTarget as HTMLElement).style.background    = 'white';
                (e.currentTarget as HTMLElement).style.borderColor   = 'var(--color-border)';
              }
            }}
          >
            {p}
          </button>
        )
      )}

      {/* Next */}
      <button
        style={{ ...BTN_BASE, opacity: page >= totalPages ? 0.4 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        aria-label="Next page"
      >
        ›
      </button>
    </div>
  );
}

function buildPageList(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | '...')[] = [1];
  if (current > 3)                              pages.push('...');
  if (current > 2)                              pages.push(current - 1);
  if (current !== 1 && current !== total)       pages.push(current);
  if (current < total - 1)                      pages.push(current + 1);
  if (current < total - 2)                      pages.push('...');
  pages.push(total);
  return pages;
}
