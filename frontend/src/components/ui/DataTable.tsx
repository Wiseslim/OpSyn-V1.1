// ============================================================
// OPSYN UI — DataTable  (Stage 3 rebuild)
// Design tokens: --color-surface-2, --color-border, --color-teal, --radius-card
// Features: alternating rows (white / surface-2), teal 2px left border on hover,
//           sort arrows, loading spinner, empty state, sticky header
// ============================================================

import React, { useState } from 'react';
import { Spinner } from './Spinner';
import { EmptyState } from './EmptyState';

export interface Column<T = any> {
  key:       string;
  header:    string;
  width?:    number | string;
  align?:    'left' | 'center' | 'right';
  sortable?: boolean;
  render?:   (value: any, row: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T = any> {
  columns:       Column<T>[];
  data:          T[];
  rowKey:        (row: T) => string | number;
  isLoading?:    boolean;
  emptyTitle?:   string;
  emptyMessage?: string;
  emptyIcon?:    React.ReactNode;
  onRowClick?:   (row: T) => void;
  stickyHeader?: boolean;
  style?:        React.CSSProperties;
}

type SortDir = 'asc' | 'desc';

// ── Sort icon ──────────────────────────────────────────────────
function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <svg width={10} height={10} viewBox="0 0 10 10" fill="none"
         style={{ opacity: active ? 1 : 0.30, marginLeft: 3 }}>
      {dir === 'asc' || !active
        ? <path d="M5 2L8 7H2L5 2Z" fill="currentColor" opacity={active && dir === 'asc' ? 1 : 0.4} />
        : null}
      {dir === 'desc' || !active
        ? <path d="M5 8L2 3H8L5 8Z" fill="currentColor" opacity={active && dir === 'desc' ? 1 : 0.4} />
        : null}
    </svg>
  );
}

// ══ DATA TABLE ════════════════════════════════════════════════
export function DataTable<T>({
  columns,
  data,
  rowKey,
  isLoading    = false,
  emptyTitle   = 'No results',
  emptyMessage,
  emptyIcon,
  onRowClick,
  stickyHeader = false,
  style,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (col: Column<T>) => {
    if (!col.sortable) return;
    if (sortKey === col.key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(col.key);
      setSortDir('asc');
    }
  };

  const sorted = React.useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a: any, b: any) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  return (
    <div style={{ width: '100%', overflow: 'hidden', ...style }}>
      <div style={{
        overflowX:    'auto',
        borderRadius: 'var(--radius-card)',
        border:       '1px solid var(--color-border)',
      }}>
        <table style={{
          width:          '100%',
          borderCollapse: 'collapse',
          fontFamily:     'var(--font-body)',
          fontSize:       13,
        }}>
          <thead>
            <tr style={{
              background: 'var(--color-surface-2)',
              position:   stickyHeader ? 'sticky' : undefined,
              top:        stickyHeader ? 0 : undefined,
              zIndex:     stickyHeader ? 1 : undefined,
            }}>
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col)}
                  style={{
                    padding:       '10px 14px',
                    textAlign:     col.align ?? 'left',
                    fontSize:      11,
                    fontWeight:    700,
                    fontFamily:    'var(--font-display)',
                    color:         'var(--color-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    borderBottom:  '1px solid var(--color-border)',
                    width:         col.width,
                    cursor:        col.sortable ? 'pointer' : 'default',
                    whiteSpace:    'nowrap',
                    userSelect:    'none',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {col.header}
                    {col.sortable && (
                      <SortIcon
                        active={sortKey === col.key}
                        dir={sortKey === col.key ? sortDir : 'asc'}
                      />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length}>
                  <Spinner center size="md" />
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState
                    icon={emptyIcon}
                    title={emptyTitle}
                    message={emptyMessage}
                    size="sm"
                  />
                </td>
              </tr>
            ) : (
              sorted.map((row, rowIdx) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={{
                    background:  rowIdx % 2 === 0 ? 'white' : 'var(--color-surface-2)',
                    transition:  'background 100ms, box-shadow 100ms',
                    cursor:      onRowClick ? 'pointer' : 'default',
                  }}
                  onMouseEnter={e => {
                    const tr = e.currentTarget as HTMLTableRowElement;
                    tr.style.background = 'rgba(0,194,168,0.06)';
                    tr.style.boxShadow  = 'inset 2px 0 0 var(--color-teal)';
                  }}
                  onMouseLeave={e => {
                    const tr = e.currentTarget as HTMLTableRowElement;
                    tr.style.background = rowIdx % 2 === 0 ? 'white' : 'var(--color-surface-2)';
                    tr.style.boxShadow  = 'none';
                  }}
                >
                  {columns.map(col => {
                    const rawValue = (row as any)[col.key];
                    return (
                      <td
                        key={col.key}
                        style={{
                          padding:      '11px 14px',
                          textAlign:    col.align ?? 'left',
                          color:        'var(--color-text-primary)',
                          borderBottom: '1px solid var(--color-border)',
                          verticalAlign:'middle',
                          whiteSpace:   'nowrap',
                          overflow:     'hidden',
                          maxWidth:     col.width ? undefined : 320,
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {col.render ? col.render(rawValue, row, rowIdx) : (rawValue ?? '—')}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
