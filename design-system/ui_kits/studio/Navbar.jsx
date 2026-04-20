/* global React, IconButton, StatusBadge, lucide */
const { useState, useEffect, useRef } = React;

function Logo() {
  return (
    <button className="nav-logo" aria-label="Main menu">
      <span className="wordmark" />
      <i data-lucide="chevron-down" className="chev" />
    </button>
  );
}

function ProjectName({ name, onChange }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const ref = useRef(null);
  useEffect(() => {
    if (editing) {
      setValue(name);
      setTimeout(() => ref.current?.select(), 0);
    }
  }, [editing, name]);
  if (editing) {
    return (
      <input
        ref={ref}
        className="project-name-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => { onChange(value.trim() || name); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { onChange(value.trim() || name); setEditing(false); }
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }
  return (
    <button className="project-name" onClick={() => setEditing(true)}>
      <span>{name}</span>
      <i data-lucide="pencil" className="project-name-edit" />
    </button>
  );
}

function Navbar({ projectName, onProjectRename, isDirty, savedAgo }) {
  useEffect(() => { lucide.createIcons(); });
  return (
    <header className="navbar">
      <div className="navbar-left">
        <Logo />
        <ProjectName name={projectName} onChange={onProjectRename} />
        <StatusBadge variant={isDirty ? 'warning' : 'neutral'}>
          {isDirty ? 'Unsaved' : savedAgo ? `Saved ${savedAgo}` : 'Saved'}
        </StatusBadge>
      </div>
      <div className="navbar-spacer" />
      <div className="navbar-right">
        <IconButton label="Save" kbd="⌘S"><i data-lucide="save" /></IconButton>
        <IconButton label="Undo" kbd="⌘Z"><i data-lucide="undo-2" /></IconButton>
        <IconButton label="Redo" kbd="⇧⌘Z"><i data-lucide="redo-2" /></IconButton>
        <IconButton label="Search icons" kbd="⌘K"><i data-lucide="search" /></IconButton>
      </div>
    </header>
  );
}

window.Navbar = Navbar;
