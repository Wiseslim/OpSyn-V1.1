// ============================================================
// OPSYN DESIGN TOOLBAR — Phase 26
// CAD-style drawing toolbar for manual network design
// Tools: Select, Point, Line, Polygon, Snap, Measure, Edit
// ============================================================

import { useState, useCallback } from 'react';
import {
  MousePointer2, CircleDot, Minus, Square, Move, Ruler, Undo2, Redo2,
  Trash2, Layers, ZoomIn, ZoomOut, Hand, RotateCw, Copy, Save,
} from 'lucide-react';

// ── Tool Types ─────────────────────────────────────────────────

export type DrawingTool =
  | 'select'
  | 'point'
  | 'line'
  | 'polygon'
  | 'move'
  | 'measure'
  | 'edit-vertices'
  | 'pan'
  | 'zoom-in'
  | 'zoom-out';

export interface ToolConfig {
  id: DrawingTool;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  description: string;
}

const TOOLS: ToolConfig[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 size={18} />, shortcut: 'V', description: 'Select and inspect assets' },
  { id: 'point', label: 'Point', icon: <CircleDot size={18} />, shortcut: 'P', description: 'Place a point asset' },
  { id: 'line', label: 'Line', icon: <Minus size={18} />, shortcut: 'L', description: 'Draw cable/line between points' },
  { id: 'polygon', label: 'Polygon', icon: <Square size={18} />, shortcut: 'G', description: 'Draw polygon area' },
  { id: 'move', label: 'Move', icon: <Move size={18} />, shortcut: 'M', description: 'Move selected assets' },
  { id: 'measure', label: 'Measure', icon: <Ruler size={18} />, shortcut: 'R', description: 'Measure distance' },
  { id: 'edit-vertices', label: 'Edit', icon: <RotateCw size={18} />, shortcut: 'E', description: 'Edit polygon vertices' },
  { id: 'pan', label: 'Pan', icon: <Hand size={18} />, shortcut: 'H', description: 'Pan the map' },
  { id: 'zoom-in', label: 'Zoom In', icon: <ZoomIn size={18} />, shortcut: '+', description: 'Zoom in' },
  { id: 'zoom-out', label: 'Zoom Out', icon: <ZoomOut size={18} />, shortcut: '-', description: 'Zoom out' },
];

// ── Styles ─────────────────────────────────────────────────────

const TOOLBAR_CONTAINER: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: 8,
  background: 'var(--bg2)',
  border: '1px solid var(--wire2)',
  borderRadius: 10,
  width: 56,
};

const TOOL_BUTTON: React.CSSProperties = {
  width: 40,
  height: 40,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 8,
  border: 'none',
  background: 'transparent',
  color: 'var(--chalk3)',
  cursor: 'pointer',
  transition: 'all .15s',
};

const DIVIDER: React.CSSProperties = {
  height: 1,
  background: 'var(--wire2)',
  margin: '4px 0',
};

const ACTIVE_TOOL: React.CSSProperties = {
  background: 'rgba(0,194,168,.12)',
  color: 'var(--color-teal)',
  border: '1px solid rgba(0,194,168,.3)',
};

const ACTION_BUTTON: React.CSSProperties = {
  ...TOOL_BUTTON,
  opacity: 0.6,
};

// ── Component Props ───────────────────────────────────────────

interface DrawingToolbarProps {
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onDelete?: () => void;
  onSave?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  canDelete?: boolean;
  disabled?: boolean;
}

// ── Component ─────────────────────────────────────────────────

export default function DrawingToolbar({
  activeTool,
  onToolChange,
  onUndo,
  onRedo,
  onDelete,
  onSave,
  canUndo = false,
  canRedo = false,
  canDelete = false,
  disabled = false,
}: DrawingToolbarProps) {
  const handleToolClick = useCallback((tool: DrawingTool) => {
    if (!disabled) {
      onToolChange(tool);
    }
  }, [disabled, onToolChange]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (disabled) return;

    const tool = TOOLS.find(t => t.shortcut?.toLowerCase() === e.key.toLowerCase());
    if (tool) {
      e.preventDefault();
      onToolChange(tool.id);
    }

    // Ctrl+Z for undo, Ctrl+Shift+Z for redo
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey && onUndo) {
        e.preventDefault();
        onUndo();
      } else if ((e.key === 'z' && e.shiftKey || e.key === 'y') && onRedo) {
        e.preventDefault();
        onRedo();
      }
    }

    // Delete key
    if (e.key === 'Delete' && canDelete && onDelete) {
      onDelete();
    }
  }, [disabled, onToolChange, onUndo, onRedo, onDelete, canDelete]);

  // Register keyboard listener
  useState(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  });

  const renderToolButton = (tool: ToolConfig) => {
    const isActive = activeTool === tool.id;
    return (
      <button
        key={tool.id}
        onClick={() => handleToolClick(tool.id)}
        disabled={disabled}
        title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}: ${tool.description}`}
        style={{
          ...TOOL_BUTTON,
          ...(isActive ? ACTIVE_TOOL : {}),
          opacity: disabled ? 0.4 : 1,
        }}
        onMouseEnter={(e) => {
          if (!isActive && !disabled) {
            e.currentTarget.style.background = 'var(--bg3)';
            e.currentTarget.style.color = 'var(--chalk)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive && !disabled) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--chalk3)';
          }
        }}
      >
        {tool.icon}
      </button>
    );
  };

  return (
    <div style={TOOLBAR_CONTAINER}>
      {/* Selection Tools */}
      {TOOLS.slice(0, 3).map(renderToolButton)}

      <div style={DIVIDER} />

      {/* Drawing Tools */}
      {TOOLS.slice(3, 6).map(renderToolButton)}

      <div style={DIVIDER} />

      {/* Navigation Tools */}
      {TOOLS.slice(7, 10).map(renderToolButton)}

      <div style={DIVIDER} />

      {/* Action Buttons */}
      <button
        onClick={onUndo}
        disabled={disabled || !canUndo}
        title="Undo (Ctrl+Z)"
        style={{
          ...TOOL_BUTTON,
          ...ACTION_BUTTON,
          opacity: canUndo ? 1 : 0.4,
        }}
      >
        <Undo2 size={18} />
      </button>

      <button
        onClick={onRedo}
        disabled={disabled || !canRedo}
        title="Redo (Ctrl+Shift+Z)"
        style={{
          ...TOOL_BUTTON,
          ...ACTION_BUTTON,
          opacity: canRedo ? 1 : 0.4,
        }}
      >
        <Redo2 size={18} />
      </button>

      <div style={DIVIDER} />

      <button
        onClick={onDelete}
        disabled={disabled || !canDelete}
        title="Delete (Del)"
        style={{
          ...TOOL_BUTTON,
          ...ACTION_BUTTON,
          color: canDelete ? 'var(--color-red)' : undefined,
          opacity: canDelete ? 1 : 0.4,
        }}
      >
        <Trash2 size={18} />
      </button>

      <button
        onClick={onSave}
        disabled={disabled}
        title="Save Design"
        style={{
          ...TOOL_BUTTON,
          ...ACTION_BUTTON,
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <Save size={18} />
      </button>
    </div>
  );
}

// ── Tooltip Component ─────────────────────────────────────────

interface TooltipProps {
  children: React.ReactNode;
  title: string;
}

export function Tooltip({ children, title }: TooltipProps) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      {children}
      <span
        style={{
          position: 'absolute',
          left: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          marginLeft: 8,
          padding: '4px 8px',
          background: 'var(--bg4)',
          border: '1px solid var(--wire2)',
          borderRadius: 6,
          fontSize: 11,
          color: 'var(--chalk)',
          whiteSpace: 'nowrap',
          opacity: 0,
          pointerEvents: 'none',
          transition: 'opacity .15s',
          zIndex: 1000,
        }}
        className="toolbar-tooltip"
      >
        {title}
      </span>
    </div>
  );
}

// ── Keyboard Shortcuts Reference ───────────────────────────────

export function KeyboardShortcuts() {
  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: '100%',
      marginLeft: 16,
      padding: 12,
      background: 'var(--bg2)',
      border: '1px solid var(--wire2)',
      borderRadius: 8,
      fontSize: 11,
      color: 'var(--chalk3)',
      width: 200,
      zIndex: 100,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--chalk)' }}>
        Keyboard Shortcuts
      </div>
      {TOOLS.filter(t => t.shortcut).map(tool => (
        <div key={tool.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span>{tool.label}</span>
          <kbd style={{
            padding: '2px 6px',
            background: 'var(--bg3)',
            borderRadius: 4,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
          }}>
            {tool.shortcut}
          </kbd>
        </div>
      ))}
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--wire2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span>Undo</span>
          <kbd style={{ padding: '2px 6px', background: 'var(--bg3)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 10 }}>Ctrl+Z</kbd>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span>Redo</span>
          <kbd style={{ padding: '2px 6px', background: 'var(--bg3)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 10 }}>Ctrl+Shift+Z</kbd>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Delete</span>
          <kbd style={{ padding: '2px 6px', background: 'var(--bg3)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 10 }}>Del</kbd>
        </div>
      </div>
    </div>
  );
}