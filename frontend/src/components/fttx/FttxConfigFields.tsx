// ============================================================
// OPSYN FTTx — the engine settings form, shared by the FTTx Designer
// wizard (Configure step) and the map's Auto design drawer (Network GIS
// Phase 5). Controlled: the caller owns the values and saves them.
// settingsFromConfig / settingsToConfig convert to and from the engine
// config (fttxSettings.ts) and keep any other keys.
// ============================================================

import { Input, Select } from '../ui';
import { DEPLOYMENT_OPTIONS, CASCADE_OPTIONS, PON_OPTIONS, type FttxSettings } from './fttxSettings';

interface Props {
  value:    FttxSettings;
  onChange: (next: FttxSettings) => void;
  /** Hide the project name/abbreviation (the design already has a project) */
  showProject?: boolean;
  /** Deployment types the caller can't run; shown disabled, with the note */
  unavailableDeployments?: string[];
  deploymentNote?: string;
}

export function FttxConfigFields({ value, onChange, showProject = true, unavailableDeployments = [], deploymentNote }: Props) {
  const set = <K extends keyof FttxSettings>(key: K, v: FttxSettings[K]) => onChange({ ...value, [key]: v });
  const deployments = DEPLOYMENT_OPTIONS.map(o => ({ ...o, disabled: unavailableDeployments.includes(o.value) }));
  return (
    <>
      {showProject && (<>
        <Input label="Project Name" value={value.project_name} onChange={v => set('project_name', v)}
          placeholder="Shown on the DED report cover page" />
        <Input
          label="Project Abbreviation" value={value.project_abbreviation} onChange={v => set('project_abbreviation', v)}
          placeholder="e.g. KKO — woven into every device tag" maxLength={10}
        />
      </>)}
      <Select label="Deployment Type" value={value.deployment_type} onChange={v => set('deployment_type', v)}
        options={deployments} hint={deploymentNote} />
      <Select label="Cascade Architecture" value={value.cascade_architecture} onChange={v => set('cascade_architecture', v)}
        options={CASCADE_OPTIONS} />
      {value.cascade_architecture !== 'legacy' && (
        <Select label="PON Architecture" value={value.pon_architecture} onChange={v => set('pon_architecture', v)}
          options={PON_OPTIONS} />
      )}
      <Input
        label="Coverage Percentage" type="number" min={10} max={100}
        value={value.coverage_pct} onChange={v => set('coverage_pct', v)} hint="Percentage of homepasses to design for (10-100)."
      />
      <div style={{ margin: '10px 0 18px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--chalk2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={value.optical_enabled} onChange={e => set('optical_enabled', e.target.checked)} />
          Run optical power budget trace (PCC architecture only)
        </label>
      </div>
    </>
  );
}
