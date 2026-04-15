import { useState } from 'react';

// Colocated demo component for components/ui/tokens/motion.mdx.
// MDX's acorn parser does not handle inline arrow-function event
// handlers on JSX elements cleanly, so the hover/elevation demo lives
// in this plain .tsx file and the MDX page just imports and renders it.

export function HoverElevationDemo() {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ marginTop: 16 }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 240,
          padding: 20,
          borderRadius: 14,
          background: 'var(--background)',
          boxShadow: hovered ? 'var(--shadow-md)' : 'var(--shadow-outline)',
          transition: 'box-shadow 160ms ease, border-color 160ms ease',
          color: 'var(--foreground)',
          fontSize: 13,
          border: '1px solid var(--border)',
        }}
      >
        Hover me — 160ms ease shift.
      </div>
    </div>
  );
}
