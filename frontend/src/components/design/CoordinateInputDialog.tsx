// ============================================================
// OPSYN COORDINATE INPUT DIALOG — Phase 30
// Precision coordinate input for accurate asset placement
// Formats: Lat/Long (decimal), UTM, DMS
// Distance and bearing calculator
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { X, MapPin, Compass, Ruler, Calculator } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────

export type CoordinateFormat = 'decimal' | 'dms' | 'utm';

export interface CoordinateInput {
  lat: number;
  lng: number;
  format: CoordinateFormat;
  valid: boolean;
}

export interface DistanceBearingInput {
  fromLat: number;
  fromLng: number;
  distance: number; // meters
  bearing: number;  // degrees (0-360, 0=North)
}

// ── Coordinate Conversion Utilities ───────────────────────────

function decimalToDMS(decimal: number, isLat: boolean): string {
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = ((minutesFloat - minutes) * 60).toFixed(2);
  const direction = isLat
    ? (decimal >= 0 ? 'N' : 'S')
    : (decimal >= 0 ? 'E' : 'W');
  return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
}

function dmsToDecimal(degrees: number, minutes: number, seconds: number, direction: string): number {
  let decimal = degrees + minutes / 60 + seconds / 3600;
  if (direction === 'S' || direction === 'W') {
    decimal = -decimal;
  }
  return decimal;
}

function decimalToUTM(lat: number, lng: number): { zone: number; hemisphere: string; easting: number; northing: number } {
  // Simplified UTM conversion (full implementation would use proj4js)
  const zone = Math.floor((lng + 180) / 6) + 1;
  const hemisphere = lat >= 0 ? 'N' : 'S';
  // Approximation for display purposes
  const easting = 500000 + (lng % 6) * 100000;
  const northing = lat >= 0 ? lat * 111320 : (lat + 90) * 111320;
  return { zone, hemisphere, easting: Math.round(easting), northing: Math.round(northing) };
}

function calculateDestination(lat: number, lng: number, distance: number, bearing: number): { lat: number; lng: number } {
  const R = 6371000; // Earth's radius in meters
  const δ = distance / R; // Angular distance
  const θ = (bearing * Math.PI) / 180; // Bearing in radians
  const φ1 = (lat * Math.PI) / 180; // Lat in radians
  const λ1 = (lng * Math.PI) / 180; // Lng in radians

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  );
  const λ2 = λ1 + Math.atan2(
    Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
    Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
  );

  return {
    lat: (φ2 * 180) / Math.PI,
    lng: (λ2 * 180) / Math.PI,
  };
}

// ── Styles ─────────────────────────────────────────────────────

const OVERLAY: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const DIALOG: React.CSSProperties = {
  background: 'var(--bg2)',
  border: '1px solid var(--wire2)',
  borderRadius: 12,
  width: 480,
  maxHeight: '80vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const HEADER: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 16,
  borderBottom: '1px solid var(--wire2)',
  background: 'var(--bg3)',
};

const CONTENT: React.CSSProperties = {
  padding: 20,
  overflow: 'auto',
  flex: 1,
};

const TAB_BAR: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  marginBottom: 16,
  borderBottom: '1px solid var(--wire2)',
  paddingBottom: 4,
};

const TAB_BUTTON: React.CSSProperties = {
  padding: '8px 16px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--chalk3)',
  borderRadius: 6,
  transition: 'all .15s',
};

const FIELD_GROUP: React.CSSProperties = {
  marginBottom: 16,
};

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--chalk3)',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--bg3)',
  border: '1px solid var(--wire2)',
  borderRadius: 6,
  color: 'var(--chalk)',
  fontFamily: 'var(--font)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

const ROW: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
};

const TRIPLE_ROW: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '2fr 2fr 1fr',
  gap: 8,
};

const INFO_BOX: React.CSSProperties = {
  padding: 12,
  background: 'rgba(0,194,168,.08)',
  border: '1px solid rgba(0,194,168,.2)',
  borderRadius: 8,
  fontSize: 11,
  color: 'var(--chalk)',
  marginTop: 16,
};

const FOOTER: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  padding: 16,
  borderTop: '1px solid var(--wire2)',
  background: 'var(--bg3)',
};

const BUTTON: React.CSSProperties = {
  flex: 1,
  padding: '10px 16px',
  borderRadius: 6,
  border: 'none',
  fontFamily: 'var(--font)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
};

// ── Component Props ───────────────────────────────────────────

interface CoordinateInputDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
  title?: string;
}

// ── Component ──────────────────────────────────────────────────

export default function CoordinateInputDialog({
  open,
  onClose,
  onConfirm,
  initialLat = 0,
  initialLng = 0,
  title = 'Enter Coordinates',
}: CoordinateInputDialogProps) {
  const [activeTab, setActiveTab] = useState<'decimal' | 'dms' | 'distance'>('decimal');

  // Decimal format state
  const [decimalLat, setDecimalLat] = useState(initialLat.toString());
  const [decimalLng, setDecimalLng] = useState(initialLng.toString());

  // DMS format state
  const [dmsLatDeg, setDmsLatDeg] = useState('0');
  const [dmsLatMin, setDmsLatMin] = useState('0');
  const [dmsLatSec, setDmsLatSec] = useState('0');
  const [dmsLatDir, setDmsLatDir] = useState('N');
  const [dmsLngDeg, setDmsLngDeg] = useState('0');
  const [dmsLngMin, setDmsLngMin] = useState('0');
  const [dmsLngSec, setDmsLngSec] = useState('0');
  const [dmsLngDir, setDmsLngDir] = useState('E');

  // Distance & Bearing state
  const [distFromLat, setDistFromLat] = useState(initialLat.toString());
  const [distFromLng, setDistFromLng] = useState(initialLng.toString());
  const [distance, setDistance] = useState('100');
  const [bearing, setBearing] = useState('0');

  // Result state
  const [resultLat, setResultLat] = useState<number | null>(null);
  const [resultLng, setResultLng] = useState<number | null>(null);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setDecimalLat(initialLat.toString());
      setDecimalLng(initialLng.toString());
      setDistFromLat(initialLat.toString());
      setDistFromLng(initialLng.toString());
      setResultLat(null);
      setResultLng(null);
    }
  }, [open, initialLat, initialLng]);

  // Calculate from decimal
  const calculateDecimal = useCallback(() => {
    const lat = parseFloat(decimalLat);
    const lng = parseFloat(decimalLng);

    if (isNaN(lat) || isNaN(lng)) {
      return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return;
    }

    setResultLat(lat);
    setResultLng(lng);
  }, [decimalLat, decimalLng]);

  // Calculate from DMS
  const calculateDMS = useCallback(() => {
    const lat = dmsToDecimal(
      parseInt(dmsLatDeg) || 0,
      parseInt(dmsLatMin) || 0,
      parseFloat(dmsLatSec) || 0,
      dmsLatDir
    );
    const lng = dmsToDecimal(
      parseInt(dmsLngDeg) || 0,
      parseInt(dmsLngMin) || 0,
      parseFloat(dmsLngSec) || 0,
      dmsLngDir
    );

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return;
    }

    setResultLat(lat);
    setResultLng(lng);
  }, [dmsLatDeg, dmsLatMin, dmsLatSec, dmsLatDir, dmsLngDeg, dmsLngMin, dmsLngSec, dmsLngDir]);

  // Calculate from distance & bearing
  const calculateDistanceBearing = useCallback(() => {
    const fromLat = parseFloat(distFromLat);
    const fromLng = parseFloat(distFromLng);
    const dist = parseFloat(distance);
    const bear = parseFloat(bearing);

    if (isNaN(fromLat) || isNaN(fromLng) || isNaN(dist) || isNaN(bear)) {
      return;
    }

    if (fromLat < -90 || fromLat > 90 || fromLng < -180 || fromLng > 180) {
      return;
    }

    if (bear < 0 || bear > 360) {
      return;
    }

    const result = calculateDestination(fromLat, fromLng, dist, bear);
    setResultLat(result.lat);
    setResultLng(result.lng);
  }, [distFromLat, distFromLng, distance, bearing]);

  // Auto-calculate on input change
  useEffect(() => {
    if (activeTab === 'decimal') calculateDecimal();
    else if (activeTab === 'dms') calculateDMS();
    else if (activeTab === 'distance') calculateDistanceBearing();
  }, [activeTab, calculateDecimal, calculateDMS, calculateDistanceBearing]);

  const handleConfirm = () => {
    if (resultLat !== null && resultLng !== null) {
      onConfirm(resultLat, resultLng);
      onClose();
    }
  };

  if (!open) return null;

  const isValid = resultLat !== null && resultLng !== null;

  return (
    <div style={OVERLAY} onClick={onClose}>
      <div style={DIALOG} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={HEADER}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MapPin size={18} style={{ color: 'var(--color-teal)' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--chalk)' }}>
              {title}
            </span>
          </div>
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
        </div>

        {/* Content */}
        <div style={CONTENT}>
          {/* Tab Bar */}
          <div style={TAB_BAR}>
            {[
              { id: 'decimal', label: 'Decimal', icon: <MapPin size={14} /> },
              { id: 'dms', label: 'DMS', icon: <Compass size={14} /> },
              { id: 'distance', label: 'Distance & Bearing', icon: <Ruler size={14} /> },
            ].map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    ...TAB_BUTTON,
                    background: active ? 'rgba(0,194,168,.12)' : 'transparent',
                    color: active ? 'var(--color-teal)' : 'var(--chalk3)',
                    border: active ? '1px solid rgba(0,194,168,.3)' : 'none',
                  }}
                >
                  {tab.icon}
                  <span style={{ marginLeft: 6 }}>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Decimal Input */}
          {activeTab === 'decimal' && (
            <>
              <div style={FIELD_GROUP}>
                <label style={LABEL}>Latitude</label>
                <input
                  type="number"
                  step="0.0000001"
                  value={decimalLat}
                  onChange={(e) => setDecimalLat(e.target.value)}
                  placeholder="e.g., 6.5244"
                  style={INPUT}
                />
              </div>
              <div style={FIELD_GROUP}>
                <label style={LABEL}>Longitude</label>
                <input
                  type="number"
                  step="0.0000001"
                  value={decimalLng}
                  onChange={(e) => setDecimalLng(e.target.value)}
                  placeholder="e.g., 3.3792"
                  style={INPUT}
                />
              </div>
            </>
          )}

          {/* DMS Input */}
          {activeTab === 'dms' && (
            <>
              <div style={FIELD_GROUP}>
                <label style={LABEL}>Latitude</label>
                <div style={TRIPLE_ROW}>
                  <input
                    type="number"
                    value={dmsLatDeg}
                    onChange={(e) => setDmsLatDeg(e.target.value)}
                    placeholder="Degrees"
                    style={INPUT}
                  />
                  <input
                    type="number"
                    value={dmsLatMin}
                    onChange={(e) => setDmsLatMin(e.target.value)}
                    placeholder="Minutes"
                    style={INPUT}
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={dmsLatSec}
                    onChange={(e) => setDmsLatSec(e.target.value)}
                    placeholder="Sec"
                    style={INPUT}
                  />
                </div>
                <select
                  value={dmsLatDir}
                  onChange={(e) => setDmsLatDir(e.target.value)}
                  style={{ ...INPUT, marginTop: 8, cursor: 'pointer' }}
                >
                  <option value="N">North (N)</option>
                  <option value="S">South (S)</option>
                </select>
              </div>

              <div style={FIELD_GROUP}>
                <label style={LABEL}>Longitude</label>
                <div style={TRIPLE_ROW}>
                  <input
                    type="number"
                    value={dmsLngDeg}
                    onChange={(e) => setDmsLngDeg(e.target.value)}
                    placeholder="Degrees"
                    style={INPUT}
                  />
                  <input
                    type="number"
                    value={dmsLngMin}
                    onChange={(e) => setDmsLngMin(e.target.value)}
                    placeholder="Minutes"
                    style={INPUT}
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={dmsLngSec}
                    onChange={(e) => setDmsLngSec(e.target.value)}
                    placeholder="Sec"
                    style={INPUT}
                  />
                </div>
                <select
                  value={dmsLngDir}
                  onChange={(e) => setDmsLngDir(e.target.value)}
                  style={{ ...INPUT, marginTop: 8, cursor: 'pointer' }}
                >
                  <option value="E">East (E)</option>
                  <option value="W">West (W)</option>
                </select>
              </div>
            </>
          )}

          {/* Distance & Bearing Input */}
          {activeTab === 'distance' && (
            <>
              <div style={FIELD_GROUP}>
                <label style={LABEL}>From Location</label>
                <div style={ROW}>
                  <input
                    type="number"
                    step="0.0000001"
                    value={distFromLat}
                    onChange={(e) => setDistFromLat(e.target.value)}
                    placeholder="Latitude"
                    style={INPUT}
                  />
                  <input
                    type="number"
                    step="0.0000001"
                    value={distFromLng}
                    onChange={(e) => setDistFromLng(e.target.value)}
                    placeholder="Longitude"
                    style={INPUT}
                  />
                </div>
              </div>
              <div style={FIELD_GROUP}>
                <label style={LABEL}>Distance (meters)</label>
                <input
                  type="number"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  placeholder="e.g., 100"
                  style={INPUT}
                />
              </div>
              <div style={FIELD_GROUP}>
                <label style={LABEL}>Bearing (degrees, 0=North)</label>
                <input
                  type="number"
                  min="0"
                  max="360"
                  value={bearing}
                  onChange={(e) => setBearing(e.target.value)}
                  placeholder="e.g., 45"
                  style={INPUT}
                />
              </div>
            </>
          )}

          {/* Result Display */}
          {isValid && (
            <div style={INFO_BOX}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Calculator size={14} style={{ color: 'var(--color-teal)' }} />
                <span style={{ fontWeight: 600 }}>Result:</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                <div>Lat: {resultLat.toFixed(7)}</div>
                <div>Lng: {resultLng.toFixed(7)}</div>
              </div>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,194,168,.2)', fontSize: 10, color: 'var(--chalk3)' }}>
                DMS: {decimalToDMS(resultLat, true)}, {decimalToDMS(resultLng, false)}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={FOOTER}>
          <button
            onClick={onClose}
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
            onClick={handleConfirm}
            disabled={!isValid}
            style={{
              ...BUTTON,
              background: isValid ? 'var(--color-teal)' : 'var(--bg3)',
              color: isValid ? '#fff' : 'var(--chalk3)',
              opacity: isValid ? 1 : 0.5,
              cursor: isValid ? 'pointer' : 'not-allowed',
            }}
          >
            <MapPin size={14} />
            Place Asset
          </button>
        </div>
      </div>
    </div>
  );
}