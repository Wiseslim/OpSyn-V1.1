// ============================================================
// OPSYN TASK FILTERS — src/pages/tasks/components/TaskFilters.tsx
// Search bar + priority / status / deadline_bucket dropdowns
// ============================================================

import type { TaskFilters } from '../../../store/task.store';
import type { Department } from '../../../../shared-types/index';


const PRIORITY_OPTIONS = [
  { label: 'All Priorities', value: '' },
  { label: 'Critical',       value: 'critical' },
  { label: 'High',           value: 'high' },
  { label: 'Medium',         value: 'medium' },
  { label: 'Low',            value: 'low' },
];

const STATUS_OPTIONS = [
  { label: 'All Statuses',   value: '' },
  { label: 'Backlog',        value: 'backlog' },
  { label: 'In Progress',    value: 'in_progress' },
  { label: 'In Review',      value: 'in_review' },
  { label: 'Done',           value: 'done' },
];

const BUCKET_OPTIONS = [
  { label: 'All Deadlines',  value: '' },
  { label: 'Overdue',        value: 'overdue' },
  { label: 'Today',          value: 'today' },
  { label: 'This Week',      value: 'this_week' },
  { label: 'Next Week',      value: 'next_week' },
  { label: 'No Deadline',    value: 'no_deadline' },
  { label: 'Backlog',        value: 'backlog' },
];

const SEL_STYLE: React.CSSProperties = {
  background:   'var(--bg3)',
  border:       '1px solid var(--wire2)',
  borderRadius: 8,
  padding:      '6px 10px',
  color:        'var(--chalk2)',
  fontFamily:   'var(--font)',
  fontSize:     11,
  outline:      'none',
  cursor:       'pointer',
};

interface Props {
  filters:      TaskFilters;
  departments:  Department[];
  onChange:     (patch: Partial<TaskFilters>) => void;
  onClear:      () => void;
  totalCount:   number;
}

export default function TaskFilters({ filters, departments, onChange, onClear, totalCount }: Props) {
  const hasActive = filters.search || filters.priority || filters.status || filters.deadline_bucket || filters.dept_id;

  return (
    <div style={{
      display:     'flex',
      alignItems:  'center',
      gap:         8,
      padding:     '8px 20px',
      flexShrink:  0,
      borderBottom: '1px solid var(--wire)',
      background:  'var(--bg2)',
      flexWrap:    'wrap',
    }}>
      {/* Search */}
      <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 300 }}>
        <input
          type="text"
          placeholder="Search tasks…"
          value={filters.search}
          onChange={e => onChange({ search: e.target.value })}
          style={{
            width:        '100%',
            background:   'var(--bg3)',
            border:       '1px solid var(--wire2)',
            borderRadius: 8,
            padding:      '6px 10px 6px 32px',
            color:        'var(--chalk)',
            fontFamily:   'var(--font)',
            fontSize:     11,
            outline:      'none',
          }}
        />
        <span style={{
          position:  'absolute',
          left:      10,
          top:       '50%',
          transform: 'translateY(-50%)',
          fontSize:  12,
          color:     'var(--chalk3)',
        }}>
          ⌕
        </span>
      </div>

      {/* Priority */}
      <select
        value={filters.priority}
        onChange={e => onChange({ priority: e.target.value as any })}
        style={SEL_STYLE}
      >
        {PRIORITY_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Status */}
      <select
        value={filters.status}
        onChange={e => onChange({ status: e.target.value as any })}
        style={SEL_STYLE}
      >
        {STATUS_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Department */}
      <select
        value={filters.dept_id}
        onChange={e => onChange({ dept_id: e.target.value })}
        style={SEL_STYLE}
      >
        <option value="">All Departments</option>
        {departments.map(d => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>

      {/* Deadline bucket */}
      <select
        value={filters.deadline_bucket}
        onChange={e => onChange({ deadline_bucket: e.target.value as any })}
        style={SEL_STYLE}
      >
        {BUCKET_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Clear */}
      {hasActive && (
        <button
          onClick={onClear}
          style={{
            background:   'rgba(248,113,113,.12)',
            border:       '1px solid rgba(248,113,113,.2)',
            borderRadius: 8,
            padding:      '6px 10px',
            color:        'var(--rose)',
            cursor:       'pointer',
            fontFamily:   'var(--font)',
            fontSize:     11,
            fontWeight:   600,
          }}
        >
          ✕ Clear
        </button>
      )}

      {/* Count */}
      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--chalk3)' }}>
        {totalCount} task{totalCount !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
