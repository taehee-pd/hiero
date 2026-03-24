type TabOption<T extends string> = {
  value: T;
  label: string;
};

export function EditorSidebarTabs<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
}: {
  ariaLabel: string;
  value: T;
  options: TabOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="wire-tab-row">
      <div className="wire-tabs" role="tablist" aria-label={ariaLabel}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={value === option.value}
            data-active={value === option.value ? 'true' : 'false'}
            className="wire-tab-button"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
