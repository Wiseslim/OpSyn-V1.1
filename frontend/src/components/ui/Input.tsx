// ============================================================
// OPSYN UI — Input + Textarea  (Stage 3 rebuild)
// Design tokens: --color-border, --color-teal, --color-red,
//                --color-text-primary, --color-text-muted, --font-body, --font-display
// Features: 40px height, teal focus ring (box-shadow), red error border,
//           required asterisk in teal, prefix/suffix icons
// ============================================================

import React, { useRef, useState } from 'react';

export interface InputProps {
  label?:       string;
  id?:          string;
  value:        string | number;
  onChange:     (value: string) => void;
  type?:        React.HTMLInputTypeAttribute;
  placeholder?: string;
  error?:       string;
  hint?:        string;
  required?:    boolean;
  disabled?:    boolean;
  readOnly?:    boolean;
  autoFocus?:   boolean;
  maxLength?:   number;
  min?:         number | string;
  max?:         number | string;
  prefix?:      React.ReactNode;
  suffix?:      React.ReactNode;
  style?:       React.CSSProperties;
  inputStyle?:  React.CSSProperties;
}

// ── Label ──────────────────────────────────────────────────────
function FieldLabel({ htmlFor, error, required, children }: {
  htmlFor?: string;
  error?:   string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} style={{
      display:       'block',
      fontSize:      11,
      fontWeight:    700,
      fontFamily:    'var(--font-display)',
      color:         error ? 'var(--color-red)' : 'var(--color-text-muted)',
      marginBottom:  5,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
    }}>
      {children}
      {required && <span style={{ color: 'var(--color-teal)', marginLeft: 2 }}>*</span>}
    </label>
  );
}

// ── Hint / Error text ──────────────────────────────────────────
function FieldMessage({ error, hint }: { error?: string; hint?: string }) {
  if (error) return <div style={{ fontSize: 11, color: 'var(--color-red)',       marginTop: 4 }}>{error}</div>;
  if (hint)  return <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{hint}</div>;
  return null;
}

// ══ INPUT ═════════════════════════════════════════════════════
export function Input({
  label,
  id,
  value,
  onChange,
  type       = 'text',
  placeholder,
  error,
  hint,
  required,
  disabled,
  readOnly,
  autoFocus,
  maxLength,
  min,
  max,
  prefix,
  suffix,
  style,
  inputStyle,
}: InputProps) {
  const inputId  = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
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
        <FieldLabel htmlFor={inputId} error={error} required={required}>
          {label}
        </FieldLabel>
      )}

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {prefix && (
          <span style={{
            position:      'absolute',
            left:          10,
            color:         'var(--color-text-muted)',
            fontSize:      13,
            pointerEvents: 'none',
            display:       'flex',
            alignItems:    'center',
          }}>
            {prefix}
          </span>
        )}

        <input
          id={inputId}
          name={inputId}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          autoFocus={autoFocus}
          maxLength={maxLength}
          min={min}
          max={max}
          required={required}
          onFocus={() => setFocused(true)}
          onBlur={()  => setFocused(false)}
          style={{
            width:        '100%',
            height:       40,
            background:   'white',
            border:       `1px solid ${borderColor}`,
            borderRadius: 8,
            padding:      `0 ${suffix ? 36 : 12}px 0 ${prefix ? 36 : 12}px`,
            color:        'var(--color-text-primary)',
            fontFamily:   'var(--font-body)',
            fontSize:     13,
            outline:      'none',
            boxShadow:    ring,
            transition:   'border-color 150ms, box-shadow 150ms',
            boxSizing:    'border-box',
            opacity:      disabled ? 0.5 : 1,
            cursor:       disabled ? 'not-allowed' : readOnly ? 'default' : undefined,
            ...inputStyle,
          }}
        />

        {suffix && (
          <span style={{
            position:      'absolute',
            right:         10,
            color:         'var(--color-text-muted)',
            fontSize:      13,
            pointerEvents: 'none',
            display:       'flex',
            alignItems:    'center',
          }}>
            {suffix}
          </span>
        )}
      </div>

      <FieldMessage error={error} hint={hint} />
    </div>
  );
}

// ══ TEXTAREA ══════════════════════════════════════════════════

export interface TextareaProps {
  label?:       string;
  id?:          string;
  value:        string;
  onChange:     (value: string) => void;
  placeholder?: string;
  rows?:        number;
  error?:       string;
  hint?:        string;
  required?:    boolean;
  disabled?:    boolean;
  maxLength?:   number;
  style?:       React.CSSProperties;
}

export function Textarea({
  label,
  id,
  value,
  onChange,
  placeholder,
  rows      = 3,
  error,
  hint,
  required,
  disabled,
  maxLength,
  style,
}: TextareaProps) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
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
        <FieldLabel htmlFor={inputId} error={error} required={required}>
          {label}
        </FieldLabel>
      )}

      <textarea
        id={inputId}
        name={inputId}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        maxLength={maxLength}
        required={required}
        onFocus={() => setFocused(true)}
        onBlur={()  => setFocused(false)}
        style={{
          width:        '100%',
          background:   'white',
          border:       `1px solid ${borderColor}`,
          borderRadius: 8,
          padding:      '10px 12px',
          color:        'var(--color-text-primary)',
          fontFamily:   'var(--font-body)',
          fontSize:     13,
          outline:      'none',
          boxShadow:    ring,
          transition:   'border-color 150ms, box-shadow 150ms',
          boxSizing:    'border-box',
          resize:       'vertical',
          minHeight:    rows * 28,
          opacity:      disabled ? 0.5 : 1,
        }}
      />

      <FieldMessage error={error} hint={hint} />
    </div>
  );
}
