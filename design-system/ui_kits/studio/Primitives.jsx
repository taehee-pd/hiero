/* global React */
const { useState } = React;

function IconButton({ label, kbd, onClick, active, children }) {
  return (
    <button
      className="ic-btn"
      data-active={active || undefined}
      aria-label={label}
      title={kbd ? `${label} · ${kbd}` : label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function StatusBadge({ variant = 'neutral', children }) {
  return <span className="status-badge" data-variant={variant}>{children}</span>;
}

function Kbd({ children }) {
  return <kbd className="kbd">{children}</kbd>;
}

window.IconButton = IconButton;
window.StatusBadge = StatusBadge;
window.Kbd = Kbd;
