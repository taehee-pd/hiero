/* global React, IconButton, lucide */
const { useEffect } = React;

function EmptyEditor({ activeProject }) {
  return (
    <div className="editor-empty studio-dots">
      <div className="editor-empty-card">
        <p className="editor-empty-msg">
          {activeProject ? 'Select an icon to start editing' : 'Select a project to get started'}
        </p>
      </div>
    </div>
  );
}

function EditorToolbar() {
  useEffect(() => { lucide.createIcons(); });
  return (
    <div className="editor-toolbar">
      <div className="tool-group">
        <IconButton label="Select (V)" active><i data-lucide="mouse-pointer-2" /></IconButton>
        <IconButton label="Direct select (A)"><i data-lucide="mouse-pointer-square-dashed" /></IconButton>
        <IconButton label="Pen (P)"><i data-lucide="pen-tool" /></IconButton>
        <IconButton label="Shape (U)"><i data-lucide="square" /></IconButton>
        <IconButton label="Ellipse"><i data-lucide="circle" /></IconButton>
        <IconButton label="Text"><i data-lucide="type" /></IconButton>
      </div>
      <div className="tool-group">
        <IconButton label="Toggle guides"><i data-lucide="ruler" /></IconButton>
        <IconButton label="Toggle snap"><i data-lucide="magnet" /></IconButton>
        <IconButton label="Show grid"><i data-lucide="grid-3x3" /></IconButton>
      </div>
    </div>
  );
}

function Canvas({ icon }) {
  return (
    <div className="canvas-area studio-dots">
      <div className="canvas-frame">
        <div className="canvas-viewport">
          <svg viewBox="0 0 24 24" className="canvas-icon">
            <defs>
              <pattern id="g" width="1" height="1" patternUnits="userSpaceOnUse">
                <rect width="1" height="1" fill="none" />
              </pattern>
            </defs>
            <rect x="0" y="0" width="24" height="24" fill="url(#g)" />
            <g stroke="var(--primary)" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
              {icon?.path}
            </g>
          </svg>
        </div>
        <div className="canvas-chrome">
          <span className="zoom-label">100%</span>
        </div>
      </div>
    </div>
  );
}

function PropertiesPanel({ icon }) {
  useEffect(() => { lucide.createIcons(); });
  if (!icon) return null;
  return (
    <aside className="props-pane">
      <div className="props-section">
        <div className="kicker">Icon</div>
        <div className="field">
          <label>Name</label>
          <input type="text" defaultValue={icon.name} />
        </div>
        <div className="field-row">
          <div className="field">
            <label>W</label>
            <input type="text" defaultValue="24" className="mono" />
          </div>
          <div className="field">
            <label>H</label>
            <input type="text" defaultValue="24" className="mono" />
          </div>
        </div>
      </div>
      <div className="props-section">
        <div className="kicker">Appearance</div>
        <div className="field">
          <label>Fill</label>
          <div className="color-field">
            <span className="color-swatch" style={{ background: '#9E64D4' }} />
            <span className="color-hex mono">#9E64D4</span>
          </div>
        </div>
        <div className="field">
          <label>Stroke width</label>
          <input type="text" defaultValue="1.8" className="mono" />
        </div>
      </div>
      <div className="props-section">
        <div className="kicker">Variants</div>
        <div className="variant-chips">
          <span className="chip chip-selected">Outline</span>
          <span className="chip">Fill</span>
          <span className="chip">Two-tone</span>
          <button className="chip chip-add"><i data-lucide="plus" /></button>
        </div>
      </div>
      <div className="props-section">
        <div className="kicker">States</div>
        <div className="state-list">
          <div className="state-row">
            <span className="state-dot" />
            <span>Default</span>
            <span className="mono duration">0ms</span>
          </div>
          <div className="state-row">
            <span className="state-dot active" />
            <span>Active</span>
            <span className="mono duration">200ms</span>
          </div>
          <div className="state-row">
            <span className="state-dot" />
            <span>Disabled</span>
            <span className="mono duration">—</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

window.EmptyEditor = EmptyEditor;
window.EditorToolbar = EditorToolbar;
window.Canvas = Canvas;
window.PropertiesPanel = PropertiesPanel;
