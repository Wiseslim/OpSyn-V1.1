// ============================================================
// OPSYN UI — Select  (Stage 3 rebuild)
// Design tokens: --color-border, --color-teal, --color-red,
//                --color-text-primary, --color-text-muted, --font-body
// Features: 40px height, teal focus ring, red error border, required asterisk
// ============================================================

import React, { useState } from 'react';

export interface SelectOption {
  label:     string;
  value:     string;
  disabled?: boolean;
}

export interface SelectProps {
  label?:       string;
  id?:          string;
  value:        string;
  onChange:     (value: string) => void;
  options:      SelectOption[];
  placeholder?: string;
  error?:       string;
  hint?:        string;
  required?:    boolean;
  disabled?:    boolean;
  style?:       React.CSSProperties;
  selectStyle?: React.CSSProperties;
}

// ══ SELECT ════════════════════════════════════════════════════
export function Select({
  label,
  id,
  value,
  onChange,
  options,
  placeholder,
  error,
  hint,
  required,
  disabled,
  style,
  selectStyle,
}: SelectProps) {
  const selectId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const [focused, setFocused] = useState(false);

  const borderColor = error   ? 'var(--color-red)'
                    : focused ? 'var(--color-teal)'
                    : 'var(--color-border)';
  const ring = focused && !error
    ? '0 0 0 2px rgba(0,194,168,0.20)'
    : 'none';

  return (
    <div style={{ marginBottom: 14, ...style }}>
      {label && (
        <label
          htmlFor={selectId}
          style={{
            display:       'block',
            fontSize:      11,
            fontWeight:    700,
            fontFamily:    'var(--font-display)',
            color:         error ? 'var(--color-red)' : 'var(--color-text-muted)',
            marginBottom:  5,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {label}
          {required && <span style={{ color: 'var(--color-teal)', marginLeft: 2 }}>*</span>}
        </label>
      )}

      <div style={{ position: 'relative' }}>
        <select
          id={selectId}
          name={selectId}
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          required={required}
          onFocus={() => setFocused(true)}
          onBlur={()  => setFocused(false)}
          style={{
            width:        '100%',
            height:       40,
            background:   'white',
            border:       `1px solid ${borderColor}`,
            borderRadius: 8,
            padding:      '0 36px 0 12px',
            color:        'var(--color-text-primary)',
            fontFamily:   'var(--font-body)',
            fontSize:     13,
            outline:      'none',
            appearance:   'none',
            boxShadow:    ring,
            transition:   'border-color 150ms, box-shadow 150ms',
            boxSizing:    'border-box',
            cursor:       disabled ? 'not-allowed' : 'pointer',
            opacity:      disabled ? 0.5 : 1,
            ...selectStyle,
          }}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(o => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Custom chevron */}
        <span style={{
          position:      'absolute',
          right:         12,
          top:           '50%',
          transform:     'translateY(-50%)',
          color:         'var(--color-text-muted)',
          pointerEvents: 'none',
          fontSize:      11,
          lineHeight:    1,
        }}>
          ▾
        </span>
      </div>

      {error && <div style={{ fontSize: 11, color: 'var(--color-red)',       marginTop: 4 }}>{error}</div>}
      {hint && !error && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
