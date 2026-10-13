// ============================================================
// OPSYN ENGINEERING PROJECT LANDING — Project Workspace
// Entry point for engineering project workflows
// Links to Design (Auto/Manual), BOQ, and Deployed sections
// ============================================================

import { useNavigate } from 'react-router-dom';
import { Network, FileText, Hammer, ChevronRight, Pen } from 'lucide-react';

const CARD_STYLE: React.CSSProperties = {
  background: 'var(--bg2)',
  border: '1px solid var(--wire2)',
  borderRadius: 12,
  padding: 24,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

interface QuickLinkProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  path: string;
}

function QuickLinkCard({ icon, title, description, path }: QuickLinkProps) {
  const navigate = useNavigate();

  return (
    <div
      style={CARD_STYLE}
      onClick={() => navigate(path)}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-teal)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--wire2)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 10,
          background: 'var(--color-teal-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-teal)',
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--chalk)', margin: 0, marginBottom: 8 }}>
            {title}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--chalk3)', margin: 0, lineHeight: 1.5 }}>
            {description}
          </p>
        </div>
        <ChevronRight size={20} style={{ color: 'var(--chalk3)', flexShrink: 0 }} />
      </div>
    </div>
  );
}

export default function ProjectLanding() {
  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--chalk)', margin: 0, marginBottom: 8 }}>
          Engineering Project
        </h1>
        <p style={{ fontSize: 14, color: 'var(--chalk3)', margin: 0 }}>
          Network design, BOQ management, and deployment tracking
        </p>
      </div>

      {/* Quick Links */}
      <div style={{ display: 'grid', gap: 16 }}>
        <QuickLinkCard
          icon={<Network size={24} />}
          title="Design › Auto Design"
          description="Automated network design using the FTTx Designer engine"
          path="/fttx-designer"
        />
        <QuickLinkCard
          icon={<Pen size={24} />}
          title="Design › Manual Design"
          description="Manual network design tools for custom layouts and modifications"
          path="/engineering/project/design/manual-design"
        />
        <QuickLinkCard
          icon={<FileText size={24} />}
          title="BOQ"
          description="Bill of Quantities - Materials, labor, and cost management"
          path="/engineering/project/boq"
        />
        <QuickLinkCard
          icon={<Hammer size={24} />}
          title="Deployed"
          description="Track deployments and manage as-built documentation"
          path="/engineering/project/deployed"
        />
      </div>

      {/* Info Box */}
      <div style={{
        background: 'var(--bg3)',
        border: '1px solid var(--wire2)',
        borderRadius: 8,
        padding: 20,
        marginTop: 32,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--chalk)', margin: 0, marginBottom: 8 }}>
          Project Workflow
        </h3>
        <p style={{ fontSize: 13, color: 'var(--chalk3)', margin: 0, lineHeight: 1.6 }}>
          <strong>Design</strong> → Create network designs using auto or manual tools.
          <br />
          <strong>BOQ</strong> → Generate bill of quantities from approved designs.
          <br />
          <strong>Deployed</strong> → Track construction progress and document as-built records.
        </p>
      </div>
    </div>
  );
}
