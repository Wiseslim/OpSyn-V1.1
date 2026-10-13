// ============================================================
// OPSYN PROPERTIES PANEL — Phase 28
// Panel to edit selected asset properties
// Form fields, real-time validation, Save/Cancel buttons
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { X, Save, AlertTriangle, CheckCircle, Info, MapPin, Ruler } from 'lucide-react';

// ── Asset Property Types ──────────────────────────────────────

export interface AssetProperties {
  id: string;
  code: string;
  name: string;
  type: string;
  category: string;
  coordinates?: { lat: number; lng: number };
  properties?: Record<string, string | number | boolean>;
  specifications?: Record<string, string>;
  notes?: string;
  status?: string;
}

export interface PropertyField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea' | 'coordinates' | 'boolean';
  value: string | number | boolean;
  options?: { label: string; value: string }[];
  required?: boolean;
  validation?: (value: any) => string | null;
  unit?: string;
}

// ── Styles ─────────────────────────────────────────────────────

const PANEL_CONTAINER: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--bg2)',
  border: '1px solid var(--wire2)',
  borderRadius: 10,
  overflow: 'hidden',
  maxWidth: 360,
  minWidth: 300,
};

const HEADER: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 14,
  borderBottom: '1px solid var(--wire2)',
  background: 'var(--bg3)',
  flexShrink: 0,
};

const CONTENT: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: 14,
};

const FIELD_CONTAINER: React.CSSProperties = {
  marginBottom: 14,
};

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--chalk3)',
  marginBottom: 5,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  background: 'var(--bg3)',
  border: '1px solid var(--wire2)',
  borderRadius: 6,
  color: 'var(--chalk)',
  fontFamily: 'var(--font)',
  fontSize: 12,
  outline: 'none',
  boxSizing: 'border-box',
};

const TEXTAREA: React.CSSProperties = {
  ...INPUT,
  minHeight: 60,
  resize: 'vertical',
};

const COORDINATES_ROW: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
};

const VALIDATION_ERROR: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  marginTop: 4,
  fontSize: 10,
  color: 'var(--color-red)',
};

const FOOTER: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  padding: 14,
  borderTop: '1px solid var(--wire2)',
  background: 'var(--bg3)',
  flexShrink: 0,
};

const BUTTON: React.CSSProperties = {
  flex: 1,
  padding: '10px 16px',
  borderRadius: 6,
  border: 'none',
  fontFamily: 'var(--font)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
};

const EMPTY_STATE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 40,
  color: 'var(--chalk3)',
  textAlign: 'center',
};

// ── Component Props ───────────────────────────────────────────

interface PropertiesPanelProps {
  selectedAsset: AssetProperties | null;
  onPropertyChange?: (assetId: string, key: string, value: any) => void;
  onSave?: (asset: AssetProperties) => void;
  onCancel?: () => void;
  onClose?: () => void;
  readOnly?: boolean;
  saving?: boolean;
}

// ── Component ──────────────────────────────────────────────────

export default function PropertiesPanel({
  selectedAsset,
  onPropertyChange,
  onSave,
  onCancel,
  onClose,
  readOnly = false,
  saving = false,
}: PropertiesPanelProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Reset form when asset changes
  useEffect(() => {
    if (selectedAsset) {
      setFormData({
        name: selectedAsset.name || '',
        code: selectedAsset.code || '',
        notes: selectedAsset.notes || '',
        status: selectedAsset.status || 'PROPOSED',
        ...selectedAsset.properties,
      });
      setErrors({});
      setTouched({});
    }
  }, [selectedAsset]);

  const handleChange = useCallback((key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setTouched(prev => ({ ...prev, [key]: true }));

    // Clear error on change
    if (errors[key]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }

    if (onPropertyChange && selectedAsset) {
      onPropertyChange(selectedAsset.id, key, value);
    }
  }, [errors, onPropertyChange, selectedAsset]);

  const validateField = useCallback((key: string, value: any): string | null => {
    switch (key) {
      case 'name':
        if (!value?.trim()) return 'Name is required';
        if (value.length > 100) return 'Name must be less than 100 characters';
        break;
      case 'code':
        if (!value?.trim()) return 'Code is required';
        break;
      case 'lat':
        if (value < -90 || value > 90) return 'Latitude must be between -90 and 90';
        break;
      case 'lng':
        if (value < -180 || value > 180) return 'Longitude must be between -180 and 180';
        break;
    }
    return null;
  }, []);

  const handleBlur = useCallback((key: string) => {
    setTouched(prev => ({ ...prev, [key]: true }));
    const error = validateField(key, formData[key]);
    if (error) {
      setErrors(prev => ({ ...prev, [key]: error }));
    }
  }, [formData, validateField]);

  const handleSave = useCallback(() => {
    // Validate all fields
    const newErrors: Record<string, string> = {};
    const fieldsToValidate = ['name', 'code', 'lat', 'lng'];

    for (const key of fieldsToValidate) {
      const error = validateField(key, formData[key]);
      if (error) {
        newErrors[key] = error;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (onSave && selectedAsset) {
      onSave({
        ...selectedAsset,
        ...formData,
        properties: { ...selectedAsset.properties, ...formData },
      });
    }
  }, [formData, onSave, selectedAsset, validateField]);

  const handleCancel = useCallback(() => {
    // Reset to original values
    if (selectedAsset) {
      setFormData({
        name: selectedAsset.name || '',
        code: selectedAsset.code || '',
        notes: selectedAsset.notes || '',
        status: selectedAsset.status || 'PROPOSED',
        ...selectedAsset.properties,
      });
      setErrors({});
      setTouched({});
    }
    onCancel?.();
  }, [onCancel, selectedAsset]);

  if (!selectedAsset) {
    return (
      <div style={PANEL_CONTAINER}>
        <div style={HEADER}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--chalk)' }}>
            Properties
          </span>
        </div>
        <div style={EMPTY_STATE}>
          <MapPin size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            No Asset Selected
          </div>
          <div style={{ fontSize: 11, maxWidth: 200 }}>
            Select an asset on the map to view and edit its properties
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={PANEL_CONTAINER}>
      {/* Header */}
      <div style={HEADER}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Info size={16} style={{ color: 'var(--color-teal)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--chalk)' }}>
            Asset Properties
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--chalk3)',
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Content */}
      <div style={CONTENT}>
        {/* Asset Info Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 16,
          padding: '8px 12px',
          background: 'rgba(0,194,168,.08)',
          borderRadius: 6,
          border: '1px solid rgba(0,194,168,.2)',
        }}>
          <span style={{ fontSize: 10, color: 'var(--color-teal)', fontWeight: 700 }}>
            {selectedAsset.category.toUpperCase()}
          </span>
          <span style={{ fontSize: 10, color: 'var(--chalk3)' }}>•</span>
          <span style={{ fontSize: 10, color: 'var(--chalk)', fontFamily: 'var(--font-mono)' }}>
            {selectedAsset.code}
          </span>
        </div>

        {/* Coordinates Section */}
        {selectedAsset.coordinates && (
          <div style={FIELD_CONTAINER}>
            <label style={LABEL}>
              <MapPin size={10} style={{ marginRight: 4 }} />
              Coordinates
            </label>
            <div style={COORDINATES_ROW}>
              <div>
                <input
                  type="number"
                  step="0.0000001"
                  value={formData.lat ?? selectedAsset.coordinates.lat}
                  onChange={(e) => handleChange('lat', parseFloat(e.target.value))}
                  onBlur={() => handleBlur('lat')}
                  disabled={readOnly}
                  placeholder="Latitude"
                  style={{
                    ...INPUT,
                    borderColor: errors.lat ? 'var(--color-red)' : undefined,
                    opacity: readOnly ? 0.6 : 1,
                  }}
                />
                {errors.lat && touched.lat && (
                  <div style={VALIDATION_ERROR}>
                    <AlertTriangle size={10} />
                    {errors.lat}
                  </div>
                )}
              </div>
              <div>
                <input
                  type="number"
                  step="0.0000001"
                  value={formData.lng ?? selectedAsset.coordinates.lng}
                  onChange={(e) => handleChange('lng', parseFloat(e.target.value))}
                  onBlur={() => handleBlur('lng')}
                  disabled={readOnly}
                  placeholder="Longitude"
                  style={{
                    ...INPUT,
                    borderColor: errors.lng ? 'var(--color-red)' : undefined,
                    opacity: readOnly ? 0.6 : 1,
                  }}
                />
                {errors.lng && touched.lng && (
                  <div style={VALIDATION_ERROR}>
                    <AlertTriangle size={10} />
                    {errors.lng}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Name Field */}
        <div style={FIELD_CONTAINER}>
          <label style={LABEL}>
            Name <span style={{ color: 'var(--color-red)' }}>*</span>
          </label>
          <input
            type="text"
            value={formData.name ?? ''}
            onChange={(e) => handleChange('name', e.target.value)}
            onBlur={() => handleBlur('name')}
            disabled={readOnly}
            placeholder="Asset name"
            style={{
              ...INPUT,
              borderColor: errors.name && touched.name ? 'var(--color-red)' : undefined,
              opacity: readOnly ? 0.6 : 1,
            }}
          />
          {errors.name && touched.name && (
            <div style={VALIDATION_ERROR}>
              <AlertTriangle size={10} />
              {errors.name}
            </div>
          )}
        </div>

        {/* Code Field (Read-only) */}
        <div style={FIELD_CONTAINER}>
          <label style={LABEL}>Code</label>
          <input
            type="text"
            value={formData.code ?? selectedAsset.code}
            disabled
            style={{ ...INPUT, opacity: 0.6, cursor: 'not-allowed' }}
          />
        </div>

        {/* Status Field */}
        <div style={FIELD_CONTAINER}>
          <label style={LABEL}>Status</label>
          <select
            value={formData.status ?? selectedAsset.status ?? 'PROPOSED'}
            onChange={(e) => handleChange('status', e.target.value)}
            disabled={readOnly}
            style={{
              ...INPUT,
              opacity: readOnly ? 0.6 : 1,
              cursor: readOnly ? 'not-allowed' : 'pointer',
            }}
          >
            <option value="PROPOSED">Proposed</option>
            <option value="APPROVED">Approved</option>
            <option value="INSTALLED">Installed</option>
            <option value="LIVE">Live</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="DECOMMISSIONED">Decommissioned</option>
          </select>
        </div>

        {/* Notes Field */}
        <div style={FIELD_CONTAINER}>
          <label style={LABEL}>Notes</label>
          <textarea
            value={formData.notes ?? ''}
            onChange={(e) => handleChange('notes', e.target.value)}
            disabled={readOnly}
            placeholder="Add notes about this asset..."
            style={{
              ...TEXTAREA,
              opacity: readOnly ? 0.6 : 1,
            }}
          />
        </div>

        {/* Specifications (if any) */}
        {selectedAsset.specifications && Object.keys(selectedAsset.specifications).length > 0 && (
          <div style={FIELD_CONTAINER}>
            <label style={LABEL}>
              <Ruler size={10} style={{ marginRight: 4 }} />
              Specifications
            </label>
            <div style={{
              background: 'var(--bg3)',
              borderRadius: 6,
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}>
              {Object.entries(selectedAsset.specifications).map(([key, value]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: 'var(--chalk3)' }}>{key}:</span>
                  <span style={{ color: 'var(--chalk)', fontWeight: 500 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {!readOnly && (
        <div style={FOOTER}>
          <button
            onClick={handleCancel}
            disabled={saving}
            style={{
              ...BUTTON,
              background: 'var(--bg2)',
              color: 'var(--chalk)',
              border: '1px solid var(--wire2)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              ...BUTTON,
              background: 'var(--color-teal)',
              color: '#fff',
            }}
          >
            {saving ? (
              <>Saving...</>
            ) : (
              <>
                <CheckCircle size={14} />
                Save Changes
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}