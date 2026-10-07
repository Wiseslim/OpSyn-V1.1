// ============================================================
// OPSYN FTTx — engine settings: the values behind FttxConfigFields and
// their conversion to and from the engine config
// (app/modules/fttx_designer/config_io.py); other config keys are kept.
// ============================================================

import type { SelectOption } from '../ui/Select';

export interface FttxSettings {
  deployment_type:      string;
  cascade_architecture: string;
  pon_architecture:     string;
  /** As typed; converted to a number on save */
  coverage_pct:         string;
  project_name:         string;
  project_abbreviation: string;
  optical_enabled:      boolean;
}

export const DEPLOYMENT_OPTIONS: SelectOption[] = [
  { label: 'Aerial',      value: 'aerial' },
  { label: 'Underground', value: 'underground' },
  { label: 'Drainage',    value: 'drainage' },
  { label: 'Hybrid',      value: 'hybrid' },
];
export const CASCADE_OPTIONS: SelectOption[] = [
  { label: 'PCC (box-to-box cascading)', value: 'pcc' },
  { label: 'Legacy (sequential)',        value: 'legacy' },
];
export const PON_OPTIONS: SelectOption[] = [
  { label: '1 PON — 64 customers/FDT',  value: 'single_pon' },
  { label: '2 PON — 128 customers/FDT', value: 'dual_pon' },
];

export function settingsFromConfig(config: Record<string, unknown> | null | undefined): FttxSettings {
  const c = config ?? {};
  return {
    deployment_type:      String(c.deployment_type ?? 'aerial'),
    cascade_architecture: String(c.cascade_architecture ?? 'pcc'),
    pon_architecture:     String(c.pon_architecture ?? 'single_pon'),
    coverage_pct:         String(c.coverage_pct ?? 100),
    project_name:         String(c.project_name ?? ''),
    project_abbreviation: String(c.project_abbreviation ?? ''),
    optical_enabled:      c.optical_enabled !== false,
  };
}

/** The settings merged into an existing config (unknown keys kept) */
export function settingsToConfig(s: FttxSettings, base: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...base,
    deployment_type:      s.deployment_type,
    cascade_architecture: s.cascade_architecture,
    // Dual PON and legacy cascade are mutually exclusive in the engine
    pon_architecture:     s.cascade_architecture === 'legacy' ? 'single_pon' : s.pon_architecture,
    coverage_pct:         Number(s.coverage_pct) || 100,
    project_name:         s.project_name,
    project_abbreviation: s.project_abbreviation,
    optical_enabled:      s.optical_enabled,
  };
}
