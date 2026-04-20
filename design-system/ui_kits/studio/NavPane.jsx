/* global React, IconButton, lucide */
const { useEffect } = React;

function NavPane({ projects, activeId, onSelect, expanded, onToggle }) {
  useEffect(() => { lucide.createIcons(); });
  return (
    <aside className="nav-pane" data-expanded={expanded}>
      <div className="nav-pane-header">
        {expanded && <span className="kicker">Projects</span>}
        <div className="nav-pane-header-actions">
          {expanded && (
            <IconButton label="New project">
              <i data-lucide="plus" />
            </IconButton>
          )}
          <IconButton label={expanded ? 'Collapse' : 'Expand'} onClick={onToggle}>
            <i data-lucide={expanded ? 'chevron-left' : 'chevron-right'} />
          </IconButton>
        </div>
      </div>
      {expanded && (
        <div className="nav-pane-list">
          {projects.map((p) => (
            <button
              key={p.id}
              className="project-row"
              data-active={p.id === activeId || undefined}
              onClick={() => onSelect(p.id)}
            >
              <i data-lucide="folder-open" />
              <span className="project-row-name">{p.name}</span>
              <span className="project-row-count">{p.iconCount}</span>
            </button>
          ))}
        </div>
      )}
      {!expanded && (
        <div className="nav-pane-collapsed">
          {projects.map((p) => (
            <button
              key={p.id}
              className="project-row-collapsed"
              data-active={p.id === activeId || undefined}
              onClick={() => onSelect(p.id)}
              title={p.name}
            >
              <i data-lucide="folder-open" />
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}

window.NavPane = NavPane;
