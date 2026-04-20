/* global React, IconButton, lucide */
const { useState, useEffect, useMemo } = React;

function IconGridItem({ icon, selected, current, onOpen, onToggleSelect }) {
  return (
    <article
      className="icon-cell"
      data-selected={selected || undefined}
      data-current={current || undefined}
      data-icon-id={icon.id}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) onToggleSelect(icon.id);
        else onOpen(icon.id);
      }}
    >
      <div className="icon-cell-preview">
        <i data-lucide={icon.glyph} />
      </div>
      <div className="icon-cell-label">{icon.name}</div>
    </article>
  );
}

function ListPane({ project, icons, currentIconId, selectedIconIds, onOpen, onToggleSelect, expanded, onToggle }) {
  const [query, setQuery] = useState('');
  useEffect(() => { lucide.createIcons(); });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return icons;
    return icons.filter((i) => i.name.toLowerCase().includes(q) || i.tags?.some((t) => t.toLowerCase().includes(q)));
  }, [icons, query]);

  return (
    <section className="list-pane" data-expanded={expanded}>
      <div className="list-pane-header">
        <div className="list-pane-title">
          <span className="project-title">{project?.name ?? '—'}</span>
          <span className="project-count">{icons.length} icons</span>
        </div>
        <div className="list-pane-header-actions">
          <IconButton label="New icon"><i data-lucide="plus" /></IconButton>
          <IconButton label="Import"><i data-lucide="folder-input" /></IconButton>
          <IconButton label="Export"><i data-lucide="arrow-down-to-line" /></IconButton>
          <IconButton label={expanded ? 'Collapse' : 'Expand'} onClick={onToggle}>
            <i data-lucide={expanded ? 'chevron-left' : 'chevron-right'} />
          </IconButton>
        </div>
      </div>
      <div className="list-pane-search">
        <i data-lucide="search" className="search-icon" />
        <input
          type="text"
          placeholder="Search icons…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button className="clear-btn" onClick={() => setQuery('')} aria-label="Clear">
            <i data-lucide="x" />
          </button>
        )}
      </div>
      <div className="list-pane-grid">
        {filtered.length === 0 ? (
          <div className="empty-state">No results found.</div>
        ) : (
          filtered.map((icon) => (
            <IconGridItem
              key={icon.id}
              icon={icon}
              selected={selectedIconIds.includes(icon.id)}
              current={currentIconId === icon.id}
              onOpen={onOpen}
              onToggleSelect={onToggleSelect}
            />
          ))
        )}
      </div>
    </section>
  );
}

window.ListPane = ListPane;
