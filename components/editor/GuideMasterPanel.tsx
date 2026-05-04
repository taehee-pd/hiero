'use client';

import { Icon as UiIcon } from '@hiero/ui-icons';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import type { GuideMaster } from '@/lib/schema/types';
import { cn } from '@/lib/utils';

const SIZE_OPTIONS = ['12', '16', '20', '24', '32', '48', 'custom'] as const;

export function GuideMasterPanel() {
  const project = useEditorStore((s) => s.project);
  const activeGuideMaster = useEditorStore(selectCurrentGuideMaster);
  const guidesVisible = useEditorStore((s) => s.guidesVisible);
  const guideStyle = useEditorStore((s) => s.guideStyle);
  const editScope = useEditorStore((s) => s.editScope);
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
    toggleGuidesVisible,
    setGuideStyle,
    enterGuideEditingMode,
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
  // Editing state — focused view of one master. Shapes are authored on the
  // canvas (rectangle / ellipse / line tools); the Inspector handles
  // numeric coordinate tuning when a shape is selected. The "Done editing"
  // affordance lives on the canvas banner, not in this panel.
  // -----------------------------------------------------------------------
  if (editingMaster) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-4 p-2.5">
            <section className="rounded-lg border border-border/70 bg-background/70 p-3">
              <div className="flex items-center gap-2">
                <UiIcon
                  name="mouse-pointer-square-dashed"
                  size={16}
                  className="size-4 text-primary"
                />
                <p className="text-sm font-semibold text-foreground">
                  Editing master
                </p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Use the rectangle, ellipse, or line tools on the canvas to
                draw guides. Click a shape and use the Inspector to tune its
                coordinates.
              </p>

              <div className="mt-3 grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="guide-master-name">Name</Label>
                  <Input
                    id="guide-master-name"
                    value={editingMaster.name}
                    onChange={(event) =>
                      updateGuideMaster(editingMaster.id, {
                        name: event.target.value,
                      })
                    }
                  />
                </div>
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
        <div className="flex flex-col gap-4 p-2.5">
          {/* Create form */}
          <section className="rounded-lg border border-border/70 bg-background/70 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  New guide master
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pick a target size; you'll draw shapes on the canvas next.
                </p>
              </div>
              <UiIcon
                name="ruler"
                size={16}
                className="size-4 text-muted-foreground"
              />
            </div>
            <div className="mt-3 grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="guide-master-size">Target size</Label>
                <Select
                  value={newMasterSize}
                  onValueChange={(value) =>
                    setNewMasterSize(value as (typeof SIZE_OPTIONS)[number])
                  }
                >
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
                <UiIcon name="plus" size={16} className="size-4" />
                <span>Create &amp; edit</span>
              </Button>
            </div>
          </section>

          {/* Library */}
          <section className="rounded-lg border border-border/70 bg-background/70 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Guide library
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Grouped by target size. The active overlay master is
                  highlighted.
                </p>
              </div>
              <span className="workspace-badge shrink-0">
                {guideMasterList.length}
              </span>
            </div>

            <div className="mt-3 flex flex-col gap-3">
              {groupedMasters.length === 0 ? (
                <div className="workspace-empty-state rounded-lg px-3 py-6 text-center text-xs text-muted-foreground">
                  No guide masters
                </div>
              ) : null}
              {groupedMasters.map((group) => (
                <div key={group.size} className="space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground">
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
                            'rounded-lg border bg-background/80 p-3 transition',
                            isActive
                              ? 'border-primary/40 bg-primary/6 shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_24%,transparent)]'
                              : 'border-border/70',
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {master.name}
                                </p>
                                {isActive ? (
                                  <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                    Active
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {shapeCount}{' '}
                                {shapeCount === 1 ? 'shape' : 'shapes'}
                              </p>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="h-7 w-7 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
                                  aria-label="Master actions"
                                >
                                  <UiIcon
                                    name="more-horizontal"
                                    size={14}
                                    className="size-3.5"
                                  />
                                </Button>
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
                              size="sm"
                              variant="outline"
                              className="flex-1"
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
          <section className="rounded-lg border border-border/70 bg-background/70 p-3">
            <p className="text-sm font-semibold text-foreground">Display</p>
            <p className="mt-1 text-xs text-muted-foreground">
              How active guides appear over the icon canvas.
            </p>
            <div className="mt-3 grid gap-3">
              <div className="grid gap-1.5">
                <Label>Visibility</Label>
                <Button
                  type="button"
                  variant={guidesVisible ? 'secondary' : 'outline'}
                  size="sm"
                  className="justify-center"
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
              </div>
              <div className="grid gap-1.5">
                <Label>Style</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={guideStyle === 'subtle' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setGuideStyle('subtle')}
                  >
                    Subtle
                  </Button>
                  <Button
                    type="button"
                    variant={guideStyle === 'strong' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setGuideStyle('strong')}
                  >
                    Strong
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
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
