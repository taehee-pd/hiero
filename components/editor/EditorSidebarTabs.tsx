import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

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
    <div className="flex min-h-[30px] items-center gap-1 px-0.5">
      <ToggleGroup
        type="single"
        value={value}
        aria-label={ariaLabel}
        className="inline-flex items-center gap-1 rounded-md bg-transparent p-0"
        onValueChange={(nextValue) => {
          if (nextValue) {
            onChange(nextValue as T);
          }
        }}
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="h-7 min-h-7 rounded-md px-2 text-[11px] leading-4 text-muted-foreground data-[state=on]:bg-background data-[state=on]:font-medium data-[state=on]:text-foreground"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
