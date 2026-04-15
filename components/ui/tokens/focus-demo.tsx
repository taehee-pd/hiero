// Colocated demo component for components/ui/tokens/focus.mdx. See the
// motion-demo.tsx note: inline arrow-function event handlers in MDX
// break acorn-jsx parsing, so the focus ring interactions live here.

const RING = '0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent)';

function ringOn(el: HTMLElement) {
  el.style.boxShadow = RING;
}
function ringOff(el: HTMLElement) {
  el.style.boxShadow = 'none';
}

export function FocusRingDemo() {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 16 }}>
      <button
        type="button"
        style={{
          padding: '8px 16px',
          borderRadius: 9999,
          background: 'var(--primary)',
          color: 'var(--primary-foreground)',
          border: 'none',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 500,
        }}
        onFocus={(e) => ringOn(e.currentTarget)}
        onBlur={(e) => ringOff(e.currentTarget)}
      >
        focus me
      </button>
      <input
        aria-label="icon name"
        placeholder="icon name"
        style={{
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--background)',
          color: 'var(--foreground)',
          fontSize: 13,
        }}
        onFocus={(e) => ringOn(e.currentTarget)}
        onBlur={(e) => ringOff(e.currentTarget)}
      />
      <a
        href="#focus"
        style={{
          color: 'var(--primary)',
          fontSize: 13,
          textDecoration: 'underline',
          textUnderlineOffset: 4,
          padding: 4,
          borderRadius: 6,
        }}
        onFocus={(e) => ringOn(e.currentTarget as HTMLElement)}
        onBlur={(e) => ringOff(e.currentTarget as HTMLElement)}
      >
        and me
      </a>
    </div>
  );
}
