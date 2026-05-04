'use client';

import { Icon as UiIcon } from '@hiero/ui-icons';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { IconButton, StatusBadge } from '@/components/ds';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getDefaultGuideMaster } from '@/lib/editor-core/guide-presets';
import { useEditorActions, useEditorStore } from '@/lib/editor-store/hooks';
import { selectCurrentGuideMaster } from '@/lib/editor-store/selectors';
import type { GuideItem, GuideMaster } from '@/lib/schema/types';
import { cn } from '@/lib/utils';

const SIZE_OPTIONS = ['12', '16', '20', '24', '32', '48', 'custom'] as const;

export function GuideMasterPanel() {
  const project = useEditorStore((s) => s.project);
  const activeGuideMaster = useEditorStore(selectCurrentGuideMaster);
  const guidesVisible = useEditorStore((s) => s.guidesVisible);
  const guideStyle = useEditorStore((s) => s.guideStyle);
  const editScope = useEditorStore((s) => s.editScope);
  const selectedGuideIndex = useEditorStore((s) => s.selection.guideIndexes?.[0] ?? null);
  const guideMasters = useMemo(
    () => project?.guideMasters ?? {},
    [project?.guideMasters],
  );
  const guideMasterList = useMemo(
    () => Object.values(guideMasters),
    [guideMasters],
  );
  const activeMasterId = activeGuideMaster?.id ?? null;
  const editingMasterId =
    editScope.kind === 'guideMaster' ? editScope.masterId : null;
  const editingMaster = editingMasterId
    ? (guideMasters[editingMasterId] ?? null)
    : null;

  const groupedMasters = useMemo(() => {
    const groups = new Map<number, GuideMaster[]>();
    for (const master of guideMasterList) {
      const bucket = groups.get(master.targetSize) ?? [];
      bucket.push(master);
      groups.set(master.targetSize, bucket);
    }
    return Array.from(groups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([size, masters]) => ({ size, masters }));
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
    enterGuideEditingMode,
    setSelection,
  } = useEditorActions();

  const [newMasterSize, setNewMasterSize] =
    useState<(typeof SIZE_OPTIONS)[number]>('24');
  const [customSize, setCustomSize] = useState('24');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingDeleteId) return;
    const timer = window.setTimeout(() => setPendingDeleteId(null), 5000);
    return () => window.clearTimeout(timer);
  }, [pendingDeleteId]);

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
    const next: GuideMaster = {
      ...preset,
      id: uniqueId,
      name: uniqueName,
    };

    addGuideMaster(next);
    enterGuideEditingMode(next.id);
  };

  const handleDuplicate = (master: GuideMaster) => {
    const duplicate: GuideMaster = {
      ...master,
      id: createUniqueRecordId(
        `${master.id}-copy`,
        Object.keys(guideMasters),
      ),
      name: createUniqueRecordName(
        `${master.name} Copy`,
        guideMasterList.map((entry) => entry.name),
      ),
      items: master.items.map((item) => ({ ...item })),
    };
    addGuideMaster(duplicate);
  };

  const confirmDelete = (master: GuideMaster) => {
    if (pendingDeleteId === master.id) {
      setPendingDeleteId(null);
      removeGuideMaster(master.id);
    } else {
      setPendingDeleteId(master.id);
    }
  };

  // -----------------------------------------------------------------------
  // Editing state — focused view of one master. Guides are semantic
  // primitives (rect, ellipse, hline, vline, drawPoint) rendered as
  // overlay strokes by the editor-overlay-canvas pipeline. They are
  // authored numerically here in the panel; the canvas shows a live
  // dashed-overlay preview at every keystroke.
  // -----------------------------------------------------------------------
  if (editingMaster) {
    const handleAddItem = (kind: GuideItem['kind']) => {
      addGuideItem(
        editingMaster.id,
        createDefaultGuideItem(kind, editingMaster.viewBox),
      );
    };

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ScrollArea className="flex-1">
          <div className="wire-section">
            <section className="grid gap-3">
              <div className="wire-section-header">
                <UiIcon
                  name="mouse-pointer-square-dashed"
                  size={16}
                  className="mr-2 size-4 text-primary"
                />
                <span>Editing master</span>
              </div>
              <p className="px-[var(--section-padding-x)] text-xs text-muted-foreground">
                Add guide primitives below. They render as a dashed overlay
                on the canvas in real time.
              </p>

              <div className="grid gap-3">
                <label className="wire-field">
                  <span className="wire-field-name">Name</span>
                  <Input
                    id="guide-master-name"
                    variant="pane"
                    value={editingMaster.name}
                    onChange={(event) =>
                      updateGuideMaster(editingMaster.id, {
                        name: event.target.value,
                      })
                    }
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <ReadOnlyField
                    label="Target size"
                    value={`${editingMaster.targetSize}px`}
                  />
                  <ReadOnlyField
                    label="ViewBox"
                    value={editingMaster.viewBox.join(' ')}
                  />
                </div>
              </div>
            </section>

            <section className="grid gap-3">
              <div className="wire-section-header">
                <div className="min-w-0">
                  <span>Guide items</span>
                </div>
                <span className="workspace-badge ml-auto shrink-0">
                  {editingMaster.items.length}
                </span>
              </div>
              <p className="px-[var(--section-padding-x)] text-xs text-muted-foreground">
                Select an item here or on canvas, then refine it in Inspect.
              </p>

              <div className="grid grid-cols-3 gap-2">
                <Button
                  size="pane"
                  variant="pane"
                  onClick={() => handleAddItem('rect')}
                >
                  <UiIcon name="plus" size={14} className="size-3.5" />
                  Rect
                </Button>
                <Button
                  size="pane"
                  variant="pane"
                  onClick={() => handleAddItem('ellipse')}
                >
                  <UiIcon name="plus" size={14} className="size-3.5" />
                  Ellipse
                </Button>
                <Button
                  size="pane"
                  variant="pane"
                  onClick={() => handleAddItem('line')}
                >
                  <UiIcon name="plus" size={14} className="size-3.5" />
                  Line
                </Button>
                <Button
                  size="pane"
                  variant="pane"
                  onClick={() => handleAddItem('hline')}
                >
                  <UiIcon name="plus" size={14} className="size-3.5" />
                  H-line
                </Button>
                <Button
                  size="pane"
                  variant="pane"
                  onClick={() => handleAddItem('vline')}
                >
                  <UiIcon name="plus" size={14} className="size-3.5" />
                  V-line
                </Button>
              </div>

              <div className="space-y-2">
                {editingMaster.items.length === 0 ? (
                  <div className="workspace-empty-state rounded-lg px-3 py-6 text-center text-xs text-muted-foreground">
                    No guide items yet
                  </div>
                ) : null}
                {editingMaster.items.map((item, index) => (
                  <GuideItemCard
                    key={`${editingMaster.id}-${index}-${item.kind}`}
                    item={item}
                    selected={selectedGuideIndex === index}
                    onSelect={() =>
                      setSelection({ layerIds: [], pointIds: [], guideIndexes: [index] })
                    }
                    onChange={(next) =>
                      updateGuideItem(editingMaster.id, index, next)
                    }
                    onRemove={() => removeGuideItem(editingMaster.id, index)}
                  />
                ))}
              </div>
            </section>
          </div>
        </ScrollArea>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Idle state — library + create form + global settings.
  // -----------------------------------------------------------------------
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="flex-1">
        <div className="wire-section">
          {/* Create form */}
          <section className="grid gap-3">
            <div className="wire-section-header">
              <span>New guide master</span>
              <UiIcon
                name="ruler"
                size={16}
                className="ml-auto size-4 text-muted-foreground"
              />
            </div>
            <p className="px-[var(--section-padding-x)] text-xs text-muted-foreground">
              Pick a target size; you'll draw shapes on the canvas next.
            </p>
            <div className="grid gap-3">
              <label className="wire-field">
                <span className="wire-field-name">Target size</span>
                <Select
                  value={newMasterSize}
                  onValueChange={(value) =>
                    setNewMasterSize(value as (typeof SIZE_OPTIONS)[number])
                  }
                >
                  <SelectTrigger id="guide-master-size" size="pane">
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
              </label>
              {newMasterSize === 'custom' ? (
                <label className="wire-field">
                  <span className="wire-field-name">Custom size</span>
                  <Input
                    id="guide-master-custom-size"
                    variant="pane"
                    type="number"
                    min="1"
                    step="1"
                    value={customSize}
                    onChange={(event) => setCustomSize(event.target.value)}
                  />
                </label>
              ) : null}
              <Button variant="pane" size="pane" onClick={handleCreateMaster}>
                <UiIcon name="plus" size={16} className="size-4" />
                <span>Create &amp; edit</span>
              </Button>
            </div>
          </section>

          {/* Library */}
          <section className="grid gap-3">
            <div className="wire-section-header">
              <span>Guide library</span>
              <span className="workspace-badge ml-auto shrink-0">
                {guideMasterList.length}
              </span>
            </div>
            <p className="px-[var(--section-padding-x)] text-xs text-muted-foreground">
              Grouped by target size. The active overlay master is highlighted.
            </p>

            <div className="flex flex-col gap-3">
              {groupedMasters.length === 0 ? (
                <div className="workspace-empty-state rounded-lg px-3 py-6 text-center text-xs text-muted-foreground">
                  No guide masters
                </div>
              ) : null}
              {groupedMasters.map((group) => (
                <div key={group.size} className="space-y-2">
                  <p className="px-[var(--section-padding-x)] text-xs font-medium text-muted-foreground">
                    {group.size} px
                  </p>
                  <div className="space-y-2">
                    {group.masters.map((master) => {
                      const isActive = activeMasterId === master.id;
                      const isPendingDelete = pendingDeleteId === master.id;
                      const shapeCount =
                        Object.keys(master.layers ?? {}).length +
                        master.items.length;

                      return (
                        <div
                          key={master.id}
                          className={cn(
                            'wire-list-row flex-col items-stretch !gap-2',
                            isActive ? null : 'hover:bg-accent/40',
                          )}
                          data-active={isActive ? 'true' : 'false'}
                        >
                          <div className="grid grid-cols-[minmax(0,1fr)_var(--button-icon-size-sm)] items-start gap-2">
                            <div className="min-w-0">
                              <div className="flex min-h-[var(--button-icon-size-sm)] items-center gap-2">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {master.name}
                                </p>
                                {isActive ? (
                                  <StatusBadge
                                    variant="accent"
                                    className="shrink-0"
                                  >
                                    Active
                                  </StatusBadge>
                                ) : null}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {shapeCount}{' '}
                                {shapeCount === 1 ? 'shape' : 'shapes'}
                              </p>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <IconButton
                                  icon={<UiIcon name="more-horizontal" />}
                                  aria-label="Master actions"
                                  tooltip={false}
                                  size="sm"
                                  radius="toolbar"
                                  className="text-muted-foreground hover:text-foreground"
                                />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onSelect={() => handleDuplicate(master)}
                                >
                                  <UiIcon
                                    name="copy"
                                    size={14}
                                    className="size-3.5"
                                  />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onSelect={() => confirmDelete(master)}
                                >
                                  <UiIcon
                                    name="trash-2"
                                    size={14}
                                    className="size-3.5"
                                  />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <div className="mt-3 flex items-center gap-2">
                            <Button
                              size="pane"
                              variant="pane"
                              onClick={() => enterGuideEditingMode(master.id)}
                            >
                              <UiIcon
                                name="mouse-pointer-square-dashed"
                                size={14}
                                className="size-3.5"
                              />
                              Edit
                            </Button>
                          </div>

                          {isPendingDelete ? (
                            <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs">
                              <span className="text-destructive">
                                Delete this master?
                              </span>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                                  onClick={() => setPendingDeleteId(null)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs font-semibold text-destructive hover:bg-destructive/15"
                                  onClick={() => confirmDelete(master)}
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Global settings */}
          <section className="grid gap-3">
            <div className="wire-section-header">Display</div>
            <p className="px-[var(--section-padding-x)] text-xs text-muted-foreground">
              How active guides appear over the icon canvas.
            </p>
            <div className="grid gap-3">
              <label className="wire-field">
                <span className="wire-field-name">Visibility</span>
                <Button
                  type="button"
                  variant="pane"
                  size="pane"
                  data-active={guidesVisible ? 'true' : 'false'}
                  onClick={toggleGuidesVisible}
                >
                  {guidesVisible ? (
                    <>
                      <UiIcon
                        name="eye"
                        size={14}
                        className="size-3.5"
                      />
                      <span>Guides visible</span>
                    </>
                  ) : (
                    <>
                      <UiIcon
                        name="eye-off"
                        size={14}
                        className="size-3.5"
                      />
                      <span>Guides hidden</span>
                    </>
                  )}
                </Button>
              </label>
              <label className="wire-field">
                <span className="wire-field-name">Style</span>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="pane"
                    size="pane"
                    data-active={guideStyle === 'subtle' ? 'true' : 'false'}
                    onClick={() => setGuideStyle('subtle')}
                  >
                    Subtle
                  </Button>
                  <Button
                    type="button"
                    variant="pane"
                    size="pane"
                    data-active={guideStyle === 'strong' ? 'true' : 'false'}
                    onClick={() => setGuideStyle('strong')}
                  >
                    Strong
                  </Button>
                </div>
              </label>
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="wire-field">
      <span className="wire-field-name">{label}</span>
      <span className="wire-input flex items-center font-mono">{value}</span>
    </label>
  );
}

function GuideItemCard({
  item,
  selected,
  onSelect,
  onChange,
  onRemove,
}: {
  item: GuideItem;
  selected: boolean;
  onSelect: () => void;
  onChange: (item: GuideItem) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={cn('wire-list-row flex-col items-stretch !gap-2')}
      data-active={selected ? 'true' : 'false'}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          {item.kind}
        </span>
        <IconButton
          icon={<UiIcon name="trash-2" />}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          aria-label="Remove guide item"
          tooltip={false}
          size="sm"
          radius="toolbar"
          className="text-muted-foreground hover:text-destructive"
        />
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
        <div className="grid gap-2">
          <NumericField
            label="Y"
            value={item.y}
            onValueChange={(y) => onChange({ kind: 'hline', y })}
          />
        </div>
      );
    case 'vline':
      return (
        <div className="grid gap-2">
          <NumericField
            label="X"
            value={item.x}
            onValueChange={(x) => onChange({ kind: 'vline', x })}
          />
        </div>
      );
    case 'line':
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumericField
            label="X1"
            value={item.x1}
            onValueChange={(x1) => onChange({ ...item, x1 })}
          />
          <NumericField
            label="Y1"
            value={item.y1}
            onValueChange={(y1) => onChange({ ...item, y1 })}
          />
          <NumericField
            label="X2"
            value={item.x2}
            onValueChange={(x2) => onChange({ ...item, x2 })}
          />
          <NumericField
            label="Y2"
            value={item.y2}
            onValueChange={(y2) => onChange({ ...item, y2 })}
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
          <NumericField
            label="Radius"
            value={item.radius ?? 0}
            onValueChange={(radius) => onChange({ ...item, radius: Math.max(0, radius) })}
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
      // Author-only primitive that doesn't render visually; kept as a
      // read-only badge so users can see it exists and can delete it.
      return (
        <p className="text-xs text-muted-foreground">
          Layer: {item.layerId || '(unset)'} · t={item.t.toFixed(2)} ·{' '}
          {item.direction ?? 'forward'}
        </p>
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
    <label className="wire-field">
      <span className="wire-field-name">{label}</span>
      <Input
        type="number"
        variant="pane"
        step="0.25"
        value={value}
        onChange={(event) => {
          const next = Number.parseFloat(event.target.value);
          if (Number.isFinite(next)) onValueChange(next);
        }}
      />
    </label>
  );
}

function createDefaultGuideItem(
  kind: GuideItem['kind'],
  viewBox: GuideMaster['viewBox'],
): GuideItem {
  const [vx, vy, vw, vh] = viewBox;
  const cx = vx + vw / 2;
  const cy = vy + vh / 2;
  switch (kind) {
    case 'hline':
      return { kind: 'hline', y: cy };
    case 'vline':
      return { kind: 'vline', x: cx };
    case 'rect':
      return {
        kind: 'rect',
        x: vx + vw * 0.125,
        y: vy + vh * 0.125,
        width: vw * 0.75,
        height: vh * 0.75,
        radius: 0,
      };
    case 'ellipse':
      return {
        kind: 'ellipse',
        cx,
        cy,
        rx: vw * 0.4,
        ry: vh * 0.4,
      };
    case 'line':
      return {
        kind: 'line',
        x1: vx + vw * 0.2,
        y1: cy,
        x2: vx + vw * 0.8,
        y2: cy,
      };
    case 'drawPoint':
      return { kind: 'drawPoint', layerId: '', t: 0.5, direction: 'forward' };
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
