'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, Eye, EyeOff, Plus, Ruler, Trash2, X } from 'lucide-react';
import { Button } from '@/components/kibo-ui/button';
import { Input } from '@/components/kibo-ui/input';
import { Label } from '@/components/kibo-ui/label';
import { ScrollArea } from '@/components/kibo-ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getDefaultGuideMaster } from '@/lib/editor-core/guide-presets';
import { useCurrentVariant, useEditorActions, useEditorStore } from '@/lib/editor-store/hooks';
import { selectCurrentGuideMaster } from '@/lib/editor-store/selectors';
import type { GuideItem, GuideMaster } from '@/lib/schema/types';
import { cn } from '@/lib/utils';

type GuideMasterPanelProps = {
  onClose: () => void;
};

const SIZE_OPTIONS = ['12', '16', '20', '24', '32', '48', 'custom'] as const;
const ITEM_KIND_OPTIONS: Array<GuideItem['kind']> = [
  'rect',
  'ellipse',
  'hline',
  'vline',
  'drawPoint',
];

export function GuideMasterPanel({ onClose }: GuideMasterPanelProps) {
  const project = useEditorStore((s) => s.project);
  const variant = useCurrentVariant();
  const activeGuideMaster = useEditorStore(selectCurrentGuideMaster);
  const guidesVisible = useEditorStore((s) => s.guidesVisible);
  const guideStyle = useEditorStore((s) => s.guideStyle);
  const guideMasters = useMemo(() => project?.guideMasters ?? {}, [project?.guideMasters]);
  const guideMasterList = useMemo(() => Object.values(guideMasters), [guideMasters]);
  const activeMasterId = activeGuideMaster?.id ?? null;
  const groupedMasters = useMemo(() => {
    const groups = new Map<number, GuideMaster[]>();
    for (const master of guideMasterList) {
      const bucket = groups.get(master.targetSize) ?? [];
      bucket.push(master);
      groups.set(master.targetSize, bucket);
    }

    return Array.from(groups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([size, masters]) => ({
        size,
        masters,
      }));
  }, [guideMasterList]);
  const {
    addGuideMaster,
    updateGuideMaster,
    removeGuideMaster,
    addGuideItem,
    updateGuideItem,
    removeGuideItem,
    toggleGuidesVisible,
    setGuideStyle,
  } = useEditorActions();

  const [selectedMasterId, setSelectedMasterId] = useState<string | null>(activeMasterId);
  const [newMasterSize, setNewMasterSize] = useState<(typeof SIZE_OPTIONS)[number]>('24');
  const [customSize, setCustomSize] = useState('24');
  const [newItemKind, setNewItemKind] = useState<GuideItem['kind']>('rect');

  useEffect(() => {
    if (selectedMasterId && guideMasters[selectedMasterId]) return;
    setSelectedMasterId(activeMasterId ?? guideMasterList[0]?.id ?? null);
  }, [activeMasterId, guideMasterList, guideMasters, selectedMasterId]);

  const selectedMaster =
    selectedMasterId && guideMasters[selectedMasterId]
      ? guideMasters[selectedMasterId]
      : null;

  const handleCreateMaster = () => {
    const parsedSize =
      newMasterSize === 'custom'
        ? Number.parseFloat(customSize)
        : Number.parseFloat(newMasterSize);
    if (!Number.isFinite(parsedSize) || parsedSize <= 0) return;

    const preset = getDefaultGuideMaster(parsedSize);
    const uniqueId = createUniqueRecordId(
      preset.id,
      Object.keys(guideMasters),
    );
    const uniqueName = createUniqueRecordName(
      preset.name,
      guideMasterList.map((master) => master.name),
    );
    const nextMaster: GuideMaster = {
      ...preset,
      id: uniqueId,
      name: uniqueName,
    };

    addGuideMaster(nextMaster);
    setSelectedMasterId(nextMaster.id);
  };

  const handleDuplicateMaster = (master: GuideMaster) => {
    const duplicate: GuideMaster = {
      ...master,
      id: createUniqueRecordId(`${master.id}-copy`, Object.keys(guideMasters)),
      name: createUniqueRecordName(
        `${master.name} Copy`,
        guideMasterList.map((entry) => entry.name),
      ),
      items: master.items.map((item) => ({ ...item })),
    };

    addGuideMaster(duplicate);
    setSelectedMasterId(duplicate.id);
  };

  const handleDeleteMaster = (master: GuideMaster) => {
    if (!window.confirm(`Delete guide master "${master.name}"?`)) return;
    removeGuideMaster(master.id);
  };

  const handleAddGuideItem = () => {
    if (!selectedMaster) return;
    addGuideItem(
      selectedMaster.id,
      createDefaultGuideItem(newItemKind, selectedMaster.viewBox),
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="workspace-panel-header flex items-start justify-between gap-3 px-4 py-4">
        <div>
          <p className="workspace-kicker">Guides</p>
          <p className="mt-2 text-sm font-semibold text-foreground">Guide masters</p>
          <p className="mt-1 text-sm uppercase text-muted-foreground">
            {variant ? `${variant.size}px variant overlay` : 'No active variant'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="workspace-tool-button h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
          onClick={onClose}
          aria-label="Close guide panel"
        >
          <X className="size-4" />
        </Button>
      </div>

      <ScrollArea className="workspace-scroll flex-1">
        <div className="flex flex-col gap-4 p-2.5">
          <section className="rounded-2xl border border-border/70 bg-background/70 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">New guide master</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Start from a preset, then tune items live on canvas.
                </p>
              </div>
              <Ruler className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-3 grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="guide-master-size">Target size</Label>
                <Select value={newMasterSize} onValueChange={(value) => setNewMasterSize(value as (typeof SIZE_OPTIONS)[number])}>
                  <SelectTrigger id="guide-master-size" className="w-full">
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option === 'custom' ? 'Custom size' : `${option}px`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {newMasterSize === 'custom' ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="guide-master-custom-size">Custom size</Label>
                  <Input
                    id="guide-master-custom-size"
                    type="number"
                    min="1"
                    step="1"
                    value={customSize}
                    onChange={(event) => setCustomSize(event.target.value)}
                  />
                </div>
              ) : null}
              <Button className="justify-center" onClick={handleCreateMaster}>
                <Plus className="size-4" />
                <span>Create guide master</span>
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-background/70 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Guide library</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Grouped by target size. The active overlay master is highlighted.
                </p>
              </div>
              <span className="workspace-badge">{guideMasterList.length}</span>
            </div>
            <div className="mt-3 flex flex-col gap-3">
              {groupedMasters.length === 0 ? (
                <div className="workspace-empty-state rounded-xl px-3 py-6 text-center text-xs text-muted-foreground">
                  No guide masters
                </div>
              ) : null}
              {groupedMasters.map((group) => (
                <div key={group.size} className="space-y-2">
                  <p className="text-sm font-semibold uppercase text-muted-foreground">
                    {group.size}px
                  </p>
                  <div className="space-y-2">
                    {group.masters.map((master) => {
                      const isSelected = selectedMasterId === master.id;
                      const isActive = activeMasterId === master.id;

                      return (
                        <button
                          key={master.id}
                          type="button"
                          onClick={() => setSelectedMasterId(master.id)}
                          className={cn(
                            'w-full rounded-xl border px-3 py-3 text-left transition',
                            isSelected
                              ? 'border-primary/40 bg-primary/6 shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_24%,transparent)]'
                              : 'border-border/80 bg-background/80 hover:border-foreground/12 hover:bg-background',
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {master.name}
                              </p>
                              <p className="mt-1 text-sm uppercase text-muted-foreground">
                                {master.items.length} items
                              </p>
                            </div>
                            {isActive ? (
                              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-semibold uppercase text-primary">
                                Active
                              </span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-background/70 p-3">
            {selectedMaster ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Master details</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Rename, duplicate, or refine guide items. Changes preview immediately.
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className={cn(
                        'workspace-tool-button h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground',
                        guidesVisible && 'bg-primary/10 text-primary',
                      )}
                      onClick={toggleGuidesVisible}
                      aria-label={guidesVisible ? 'Hide guides' : 'Show guides'}
                    >
                      {guidesVisible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="workspace-tool-button h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
                      onClick={() => handleDuplicateMaster(selectedMaster)}
                      aria-label="Duplicate guide master"
                    >
                      <Copy className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="workspace-tool-button h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteMaster(selectedMaster)}
                      aria-label="Delete guide master"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label>Guide style</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={guideStyle === 'subtle' ? 'secondary' : 'ghost'}
                        className="justify-center"
                        onClick={() => setGuideStyle('subtle')}
                      >
                        Subtle
                      </Button>
                      <Button
                        type="button"
                        variant={guideStyle === 'strong' ? 'secondary' : 'ghost'}
                        className="justify-center"
                        onClick={() => setGuideStyle('strong')}
                      >
                        Strong
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="guide-master-name">Name</Label>
                    <Input
                      id="guide-master-name"
                      value={selectedMaster.name}
                      onChange={(event) =>
                        updateGuideMaster(selectedMaster.id, { name: event.target.value })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <ReadOnlyField label="Target size" value={`${selectedMaster.targetSize}px`} />
                    <ReadOnlyField
                      label="ViewBox"
                      value={selectedMaster.viewBox.join(' ')}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Guide items</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Add primitives, then adjust coordinates numerically.
                      </p>
                    </div>
                    <span className="workspace-badge">{selectedMaster.items.length}</span>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Select
                      value={newItemKind}
                      onValueChange={(value) => setNewItemKind(value as GuideItem['kind'])}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ITEM_KIND_OPTIONS.map((kind) => (
                          <SelectItem key={kind} value={kind}>
                            {kind}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleAddGuideItem}>
                      <Plus className="size-4" />
                      <span>Add</span>
                    </Button>
                  </div>

                  <div className="mt-3 space-y-3">
                    {selectedMaster.items.length === 0 ? (
                      <div className="workspace-empty-state rounded-xl px-3 py-6 text-center text-xs text-muted-foreground">
                        No guide items
                      </div>
                    ) : null}
                    {selectedMaster.items.map((item, index) => (
                      <GuideItemCard
                        key={`${selectedMaster.id}-${index}-${item.kind}`}
                        item={item}
                        onChange={(nextItem) =>
                          updateGuideItem(selectedMaster.id, index, nextItem)
                        }
                        onRemove={() => removeGuideItem(selectedMaster.id, index)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="workspace-empty-state rounded-xl px-3 py-6 text-center text-xs text-muted-foreground">
                Select a guide master to edit it
              </div>
            )}
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

function GuideItemCard({
  item,
  onChange,
  onRemove,
}: {
  item: GuideItem;
  onChange: (item: GuideItem) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/80 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold uppercase text-muted-foreground">
          {item.kind}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="workspace-tool-button h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label="Remove guide item"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      <div className="mt-3">
        <GuideItemFields item={item} onChange={onChange} />
      </div>
    </div>
  );
}

function GuideItemFields({
  item,
  onChange,
}: {
  item: GuideItem;
  onChange: (item: GuideItem) => void;
}) {
  switch (item.kind) {
    case 'hline':
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumericField
            label="Y"
            value={item.y}
            onValueChange={(y) => onChange({ kind: 'hline', y })}
          />
        </div>
      );
    case 'vline':
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumericField
            label="X"
            value={item.x}
            onValueChange={(x) => onChange({ kind: 'vline', x })}
          />
        </div>
      );
    case 'rect':
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumericField
            label="X"
            value={item.x}
            onValueChange={(x) => onChange({ ...item, x })}
          />
          <NumericField
            label="Y"
            value={item.y}
            onValueChange={(y) => onChange({ ...item, y })}
          />
          <NumericField
            label="Width"
            value={item.width}
            onValueChange={(width) => onChange({ ...item, width })}
          />
          <NumericField
            label="Height"
            value={item.height}
            onValueChange={(height) => onChange({ ...item, height })}
          />
        </div>
      );
    case 'ellipse':
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumericField
            label="CX"
            value={item.cx}
            onValueChange={(cx) => onChange({ ...item, cx })}
          />
          <NumericField
            label="CY"
            value={item.cy}
            onValueChange={(cy) => onChange({ ...item, cy })}
          />
          <NumericField
            label="RX"
            value={item.rx}
            onValueChange={(rx) => onChange({ ...item, rx })}
          />
          <NumericField
            label="RY"
            value={item.ry}
            onValueChange={(ry) => onChange({ ...item, ry })}
          />
        </div>
      );
    case 'drawPoint':
      return (
        <div className="grid gap-2">
          <TextField
            label="Layer ID"
            value={item.layerId}
            onValueChange={(layerId) => onChange({ ...item, layerId })}
          />
          <div className="grid grid-cols-2 gap-2">
            <NumericField
              label="T"
              value={item.t}
              onValueChange={(t) => onChange({ ...item, t })}
            />
            <div className="grid gap-1.5">
              <Label className="text-sm uppercase text-muted-foreground">
                Direction
              </Label>
              <Select
                value={item.direction ?? 'forward'}
                onValueChange={(direction) =>
                  onChange({
                    ...item,
                    direction: direction as 'forward' | 'reverse',
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="forward">forward</SelectItem>
                  <SelectItem value="reverse">reverse</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      );
  }
}

function NumericField({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-sm uppercase text-muted-foreground">
        {label}
      </Label>
      <Input
        type="number"
        step="0.25"
        value={value}
        onChange={(event) => {
          const nextValue = Number.parseFloat(event.target.value);
          if (Number.isFinite(nextValue)) onValueChange(nextValue);
        }}
      />
    </div>
  );
}

function TextField({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-sm uppercase text-muted-foreground">
        {label}
      </Label>
      <Input value={value} onChange={(event) => onValueChange(event.target.value)} />
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2">
      <p className="text-sm uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function createDefaultGuideItem(
  kind: GuideItem['kind'],
  viewBox: GuideMaster['viewBox'],
): GuideItem {
  const [vx, vy, vw, vh] = viewBox;
  const centerX = vx + vw / 2;
  const centerY = vy + vh / 2;

  switch (kind) {
    case 'hline':
      return { kind: 'hline', y: centerY };
    case 'vline':
      return { kind: 'vline', x: centerX };
    case 'rect':
      return {
        kind: 'rect',
        x: vx + vw * 0.125,
        y: vy + vh * 0.125,
        width: vw * 0.75,
        height: vh * 0.75,
      };
    case 'ellipse':
      return {
        kind: 'ellipse',
        cx: centerX,
        cy: centerY,
        rx: vw * 0.4,
        ry: vh * 0.4,
      };
    case 'drawPoint':
      return {
        kind: 'drawPoint',
        layerId: '',
        t: 0.5,
        direction: 'forward',
      };
  }
}

function createUniqueRecordName(base: string, existing: string[]) {
  if (!existing.includes(base)) return base;

  let counter = 2;
  let nextValue = `${base} ${counter}`;
  while (existing.includes(nextValue)) {
    counter += 1;
    nextValue = `${base} ${counter}`;
  }

  return nextValue;
}

function createUniqueRecordId(base: string, existing: string[]) {
  if (!existing.includes(base)) return base;

  let counter = 2;
  let nextValue = `${base}-${counter}`;
  while (existing.includes(nextValue)) {
    counter += 1;
    nextValue = `${base}-${counter}`;
  }

  return nextValue;
}
