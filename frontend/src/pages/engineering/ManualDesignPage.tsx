import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, LoaderCircle, Map, PenLine, Plus, Radio, Search } from 'lucide-react';
import { designApi } from '../../api/design.api';
import { projectsApi } from '../../api/projects.api';
import type { Design } from '@shared';

const panel: React.CSSProperties = {
  background: 'var(--bg2)', border: '1px solid var(--wire2)', borderRadius: 10,
};

function launchDesign(navigate: ReturnType<typeof useNavigate>, id: string) {
  navigate(`/network?mode=design&design=${encodeURIComponent(id)}`);
}

export default function ManualDesignPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState('');
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');

  const projects = useQuery({ queryKey: ['manual-design', 'projects'], queryFn: projectsApi.list });
  const selectedProject = projects.data?.find(project => project.id === projectId) ?? projects.data?.[0];
  const activeProjectId = projectId || selectedProject?.id || '';
  const designs = useQuery({
    queryKey: ['manual-design', 'designs', activeProjectId],
    queryFn: () => designApi.list(activeProjectId),
    enabled: !!activeProjectId,
  });
  const createDesign = useMutation({
    mutationFn: () => designApi.create(activeProjectId, { name: name.trim() || 'Untitled manual design' }),
    onSuccess: async design => {
      await queryClient.invalidateQueries({ queryKey: ['manual-design', 'designs', activeProjectId] });
      launchDesign(navigate, design.id);
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (designs.data ?? []).filter(design => !q || `${design.name} ${design.description ?? ''}`.toLowerCase().includes(q));
  }, [designs.data, search]);

  const statusColor = (status: string) => status === 'APPROVED' ? 'var(--color-green)' : status === 'MODIFIED' ? 'var(--color-amber)' : 'var(--color-blue)';

  return (
    <main style={{ minHeight: '100%', padding: '32px clamp(20px, 4vw, 56px)', color: 'var(--chalk)', background: 'var(--bg1, var(--bg2))' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <button type="button" onClick={() => navigate('/engineering/project')} style={{ border: 0, padding: 0, background: 'none', color: 'var(--chalk3)', cursor: 'pointer', font: 'inherit', fontSize: 12 }}>
          Engineering projects
        </button>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, margin: '20px 0 28px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-teal)', marginBottom: 10 }}>
              <Map size={18} /><span style={{ fontSize: 12, fontWeight: 650 }}>Network design</span>
            </div>
            <h1 style={{ margin: 0, fontSize: 'clamp(25px, 3vw, 34px)', letterSpacing: '-0.035em' }}>Manual design</h1>
            <p style={{ maxWidth: 580, color: 'var(--chalk3)', fontSize: 14, lineHeight: 1.6, margin: '10px 0 0' }}>
              Place network equipment, route fibre, and work against the live infrastructure map. Every edit is saved to the selected project design.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--chalk3)', fontSize: 12, whiteSpace: 'nowrap' }}>
            <Radio size={15} color="var(--color-teal)" /> Project linked
          </div>
        </header>

        <section style={{ ...panel, padding: 20, marginBottom: 28 }} aria-label="Create a manual design">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', borderRadius: 7, color: 'var(--color-teal)', background: 'rgba(0,194,168,.11)' }}><PenLine size={16} /></span>
            <div><h2 style={{ fontSize: 15, margin: 0 }}>Start a design</h2><p style={{ color: 'var(--chalk3)', margin: '4px 0 0', fontSize: 12 }}>Choose a project to keep the design, BOQ, and deployment together.</p></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) minmax(220px, 1.2fr) auto', gap: 10 }}>
            <label style={{ display: 'grid', gap: 6, color: 'var(--chalk3)', fontSize: 11 }}>
              Project
              <select value={activeProjectId} onChange={event => setProjectId(event.target.value)} disabled={projects.isLoading || !projects.data?.length}
                style={{ height: 40, padding: '0 10px', background: 'var(--bg3)', color: 'var(--chalk)', border: '1px solid var(--wire2)', borderRadius: 6, font: 'inherit', fontSize: 13 }}>
                {projects.data?.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6, color: 'var(--chalk3)', fontSize: 11 }}>
              Design name
              <input value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Ikeja North fibre extension"
                onKeyDown={event => { if (event.key === 'Enter' && activeProjectId && !createDesign.isPending) createDesign.mutate(); }}
                style={{ height: 40, boxSizing: 'border-box', padding: '0 10px', background: 'var(--bg3)', color: 'var(--chalk)', border: '1px solid var(--wire2)', borderRadius: 6, font: 'inherit', fontSize: 13 }} />
            </label>
            <button type="button" onClick={() => createDesign.mutate()} disabled={!activeProjectId || createDesign.isPending || projects.isLoading}
              style={{ alignSelf: 'end', height: 40, padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: 8, border: 0, borderRadius: 6, background: 'var(--color-teal)', color: '#06221f', fontWeight: 700, cursor: 'pointer', opacity: !activeProjectId || createDesign.isPending ? .6 : 1 }}>
              {createDesign.isPending ? <LoaderCircle size={15} className="spin" /> : <Plus size={15} />} Create design
            </button>
          </div>
          {projects.isLoading && <p role="status" style={{ color: 'var(--chalk3)', fontSize: 12 }}>Loading projects…</p>}
          {projects.isError && <p role="alert" style={{ color: 'var(--color-red)', fontSize: 12 }}>Projects could not be loaded. Refresh and try again.</p>}
          {!projects.isLoading && projects.data?.length === 0 && <p style={{ color: 'var(--chalk3)', fontSize: 12, marginBottom: 0 }}>Create an engineering project before starting a design.</p>}
          {createDesign.isError && <p role="alert" style={{ color: 'var(--color-red)', fontSize: 12 }}>Design could not be created. Check your access and try again.</p>}
        </section>

        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
            <div><h2 style={{ margin: 0, fontSize: 17 }}>Existing designs</h2><p style={{ margin: '4px 0 0', color: 'var(--chalk3)', fontSize: 12 }}>{selectedProject?.name ?? 'Select a project'} · {designs.data?.length ?? 0} designs</p></div>
            <label style={{ position: 'relative', width: 230 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--chalk3)' }} />
              <input aria-label="Search designs" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a design"
                style={{ width: '100%', height: 36, boxSizing: 'border-box', padding: '0 10px 0 32px', background: 'var(--bg3)', color: 'var(--chalk)', border: '1px solid var(--wire2)', borderRadius: 6, font: 'inherit', fontSize: 12 }} />
            </label>
          </div>
          {designs.isLoading && <p role="status" style={{ color: 'var(--chalk3)', fontSize: 13 }}>Loading project designs…</p>}
          {designs.isError && <p role="alert" style={{ color: 'var(--color-red)', fontSize: 13 }}>Designs could not be loaded for this project.</p>}
          {!designs.isLoading && filtered.length > 0 && <div style={{ display: 'grid', gap: 8 }}>
            {filtered.map((design: Design) => <DesignRow key={design.id} design={design} color={statusColor(design.status)} onOpen={() => launchDesign(navigate, design.id)} />)}
          </div>}
          {!designs.isLoading && !designs.isError && activeProjectId && filtered.length === 0 && <div style={{ ...panel, padding: '22px 20px', color: 'var(--chalk3)', fontSize: 13 }}>{search ? 'No designs match that search.' : 'No designs in this project yet. Create one above to begin placing network equipment.'}</div>}
        </section>
      </div>
    </main>
  );
}

function DesignRow({ design, color, onOpen }: { design: Design; color: string; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} style={{ ...panel, width: '100%', minHeight: 68, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, color: 'var(--chalk)', textAlign: 'left', cursor: 'pointer' }}>
    <span style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 7, color: 'var(--color-teal)', background: 'rgba(0,194,168,.09)' }}><Map size={17} /></span>
    <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block', fontSize: 13, fontWeight: 650 }}>{design.name}</span><span style={{ display: 'block', marginTop: 4, color: 'var(--chalk3)', fontSize: 11 }}>{design.description || 'Network layout and infrastructure plan'}</span></span>
    <span style={{ padding: '4px 8px', borderRadius: 5, color, background: `color-mix(in srgb, ${color} 12%, transparent)`, fontSize: 10, fontWeight: 700 }}>{design.status.replace('_', ' ')}</span>
    <ArrowRight size={16} color="var(--chalk3)" />
  </button>;
}
