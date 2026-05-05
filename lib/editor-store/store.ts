import {
  getVariantDefaultTypeId,
  normalizeVariant,
} from '@/lib/schema/types';
import type {
  Project,
  Workspace,
  IconSet,
  IconSetTypeDef,
  Icon,
  Layer,
  PrimitiveShape,
  TopologyContract,
  Effect,
  GuideMaster,
  GuideSet,
  GuideItem,
  Collection,
  SymbolComponent,
  SymbolScale,
  SymbolWeight,
  SyncTarget,
  Variant,
  IconType,
  RenderingMode,
} from '@/lib/schema/types';
import {
  createWorkspaceFromProject,
  getActiveIconSet,
  getFirstIconSetId,
  replaceWorkspaceIconSet,
} from '@/lib/schema/workspace';
import type {
  Tool,
  SelectionState,
  ViewportState,
  ShapeType,
  PointMarqueeState,
  PointTransformLabelState,
  PendingPenHandleState,
} from './types';
import { booleanOp, type BooleanMode } from '@/lib/editor-core/boolean-ops';
import {
  buildLeftLeaningCompound,
  operandIdsInTree,
} from '@/lib/schema/compound';
import { getDefaultGuideMaster } from '@/lib/editor-core/guide-presets';
import { buildPrimitivePath } from '@/lib/editor-core/path-shapes';
import { areTopologiesCompatible, computeTopology } from '@/lib/editor-core/topology';
import type { SnapTarget } from '@/lib/editor-core/snap-engine';
import type { InterpolatedValues, ResolvedTransition } from '@/lib/runtime-core';
import { interpolateTransitionValues } from '@/lib/runtime-core';

/**
 * What the editor canvas + inspector + layer panel are operating on right
 * now. The vast majority of time this is `kind: 'icon'`. `kind: 'guideMaster'`
 * is entered from the Guide panel; while it's active, every layer-mutating
 * store action routes writes onto the master's `layers` instead of the icon
 * variant's `layers`, and selectors reshape the "current" snapshot so
 * downstream panels see the master as if it were a variant.
 *
 * Icon-scope-only actions (symbol tagging, variant matrix, paste *into* an
 * icon, publish/sync) early-return when `kind !== 'icon'` — there is no
 * meaningful icon to operate on.
 */
export type EditScope =
  | { kind: 'icon' }
  | { kind: 'guideMaster'; masterId: string };

export type EditorState = {
  workspace: Workspace | null;
  project: Project | null;
  activeIconSetId: string | null;
  isDirty: boolean;
  /** Timestamp (ms epoch) of last successful background autosave to IDB. */
  lastSavedAt: number | null;
  /** Timestamp (ms epoch) of last explicit draft checkpoint (Cmd+S). */
  lastCheckpointAt: number | null;
  /** Timestamp (ms epoch) of last successful publish. Set by Phase 2. */
  lastPublishedAt: number | null;
  /** Version string of last published release (e.g. "1.2.0"). Phase 2. */
  lastPublishedVersion: string | null;
  currentIconId: string | null;
  currentVariantId: string | null;
  /** Currently selected IconType id (e.g. "line", "filled"). */
  currentTypeId: string | null;
  selectedIconGuideIndex: number | null;
  selection: SelectionState;
  activeSnapGuides: SnapTarget[];
  snapEnabled: boolean;
  guidesVisible: boolean;
  guideStyle: 'subtle' | 'strong';
  viewport: ViewportState;
  tool: Tool;
  renderingMode: RenderingMode;
  shapeSubTool: ShapeType;
  shapePolygonSides: number;
  shapeStarPoints: number;
  /**
   * Describes *what the canvas is currently editing*. `kind: 'icon'` is the
   * normal case — Inspector, Layer panel, PathEditor, and the snap engine
   * operate on the referenced icon variant's layers. `kind: 'guideMaster'`
   * is entered from the Guide panel's "Edit on canvas" toggle; the icon is
   * hidden and all editing operates on the master's `layers` instead.
   *
   * `currentIconId` / `currentVariantId` / `currentTypeId` remain valid while
   * in guide scope — they hold the resume point that `exitGuideEditingMode`
   * restores.
   */
  editScope: EditScope;
  pointMarquee: PointMarqueeState | null;
  pointTransformLabel: PointTransformLabelState | null;
  pendingPenHandle: PendingPenHandleState | null;
  transitionPreview: TransitionPreview | null;
  selectedTransitionId: string | null;
  favorites: string[];
  openTabs: EditorTab[];
  activeTabId: string | null;
  /** Phase N: true while a derived variant is being generated. */
  isDeriving: boolean;
  /** G4: Pending npm publishes with countdown, tracked per target. */
  pendingPublishes: Array<{
    targetId: string;
    scheduledAt: number;
    semver: 'patch' | 'minor' | 'major';
  }>;
  /**
   * Internal guard to avoid re-queuing auto-publish when we save publish
   * metadata such as lastPublishedVersion.
   */
  skipNextAutoPublish: boolean;
  /** Studio layout: whether the nav pane is expanded */
  navPaneExpanded: boolean;
  /** Studio layout: whether the list pane (icon grid) is expanded */
  listPaneExpanded: boolean;
  /** Multi-select: icon IDs selected in the grid (separate from currentIconId) */
  selectedIconIds: string[];
  /** Layer clipboard: used by copy/paste on the canvas context menu and shortcuts */
  layerClipboard: Layer[];
};

export type EditorTab = {
  id: string;
  iconSetId: string;
  iconId: string;
  variantId: string | null;
};

export type TransitionPreview = {
  transitionId: string;
  baseIconId?: string;       // Cross-icon source
  baseVariantId?: string;    // Cross-icon source variant
  targetIconId?: string;     // Cross-icon target
  targetVariantId?: string;  // Cross-icon target variant
  progress: number;
  resolvedTransition: ResolvedTransition;
  interpolatedValues: InterpolatedValues;
};

export type EditorActions = {
  loadWorkspace(workspace: Workspace, options?: LoadProjectOptions): void;
  loadProject(project: ProjectInput, options?: LoadProjectOptions): void;
  newProject(): void;
  markSaved(updatedAt?: string): void;
  /** Record a successful draft checkpoint at the given timestamp (default: now). */
  markCheckpointSaved(at?: number): void;
  /** Record a successful publish at the given timestamp + version. Phase 2. */
  markPublished(version: string, at?: number): void;
  createBlankIcon(options?: { name?: string; size?: number }): string | null;
  insertIcon(icon: Icon): void;
  renameIcon(iconId: string, name: string): void;
  duplicateIcon(iconId: string): string | null;
  removeIcon(iconId: string): void;
  addVariant(iconId: string, variant: VariantInput): void;
  removeVariant(iconId: string, variantId: string): void;
  patchVariant(iconId: string, variantId: string, patch: VariantPatch): void;
  addEffect(iconId: string, effect: Effect): void;
  removeEffect(iconId: string, effectId: string): void;
  patchEffect(iconId: string, effectId: string, patch: Partial<Effect>): void;
  duplicateLayersToVariant(
    iconId: string,
    fromVariantId: string,
    toVariantId: string,
  ): void;
  setCurrentIcon(id: string): void;
  setCurrentVariant(id: string): void;
  setCurrentType(id: string): void;
  addType(typeId: string): void;
  removeType(typeId: string): void;
  renameType(oldTypeId: string, newTypeId: string): void;
  /**
   * Update the *display label* of a type entry in the IconSet catalog,
   * without changing its structural id. Use this to let users "rename"
   * the default type — whose id is structurally required to stay stable
   * because it's referenced throughout the runtime, export, and
   * transition pipelines as the literal string the schema was serialized
   * with. Passing an empty name clears the custom label and falls back
   * to the type id.
   */
  setTypeName(typeId: string, name: string): void;
  duplicateType(sourceTypeId: string, newTypeId: string): void;
  setTopology(iconId: string, variantId: string, topology: TopologyContract | undefined): void;
  setStateTopology(iconId: string, typeId: string, topology: TopologyContract | undefined): void;
  setSelectedIconGuideIndex(index: number | null): void;
  patchLayer(iconId: string, layerId: string, patch: Partial<Layer>): void;
  /**
   * Append a freshly-created layer to whatever the editor is currently
   * scoped to — the active icon variant in icon scope, or the bound guide
   * master in guide scope. Used by `PathEditor` for shape- and pen-tool
   * layer creation so callers don't have to branch on scope themselves.
   */
  addLayer(layer: Layer): void;
  renameLayer(iconId: string, oldLayerId: string, newLayerId: string): void;
  setLayerVisibility(iconId: string, layerId: string, visible: boolean): void;
  setClipMask(clipLayerId: string, targetLayerIds: string[]): void;
  releaseClipMask(layerId: string): void;
  setSelection(selection: SelectionState): void;
  clearSelection(): void;
  setActiveSnapGuides(guides: SnapTarget[]): void;
  toggleSnap(): void;
  toggleGuidesVisible(): void;
  setGuideStyle(style: 'subtle' | 'strong'): void;
  setViewport(viewport: Partial<ViewportState>): void;
  setTool(tool: Tool): void;
  setShapeSubTool(shapeSubTool: ShapeType): void;
  setShapePolygonSides(sides: number): void;
  setShapeStarPoints(points: number): void;
  enterGuideEditingMode(masterId: string): void;
  exitGuideEditingMode(): void;
  /** Write a new primitive onto an existing layer AND regenerate path.d. */
  setLayerPrimitive(iconId: string, layerId: string, next: PrimitiveShape): void;
  setPointMarquee(marquee: PointMarqueeState | null): void;
  setPointTransformLabel(label: PointTransformLabelState | null): void;
  setPendingPenHandle(handle: PendingPenHandleState | null): void;
  setTransitionPreview(preview: TransitionPreview | null): void;
  updateTransitionPreview(progress: number): void;
  stopTransitionPreview(): void;
  setSelectedTransitionId(transitionId: string | null): void;
  updateProjectMeta(patch: Partial<Project['meta']>): void;
  addGuideMaster(master: GuideMaster): void;
  updateGuideMaster(id: string, patch: Partial<GuideMaster>): void;
  removeGuideMaster(id: string): void;
  addGuideItem(masterId: string, item: GuideItem): void;
  updateGuideItem(masterId: string, index: number, item: GuideItem): void;
  removeGuideItem(masterId: string, index: number): void;
  addIconGuide(iconId: string, item: GuideItem): void;
  updateIconGuide(iconId: string, index: number, item: GuideItem): void;
  removeIconGuide(iconId: string, index: number): void;
  removeSelectedGuides(iconId: string, indexes: number[]): void;
  addCollection(collection: Collection): void;
  removeCollection(collectionId: string): void;
  renameCollection(collectionId: string, name: string): void;
  addIconToCollection(collectionId: string, iconId: string): void;
  removeIconFromCollection(collectionId: string, iconId: string): void;
  toggleFavorite(iconId: string): void;
  addIconSet(name: string): string | null;
  removeIconSet(iconSetId: string): void;
  renameIconSet(iconSetId: string, name: string): void;
  setActiveIconSet(iconSetId: string): void;
  addSyncTarget(target: SyncTarget): void;
  updateSyncTarget(targetId: string, patch: Partial<SyncTarget>): void;
  removeSyncTarget(targetId: string): void;
  schedulePendingPublish(targetId: string, semver: 'patch' | 'minor' | 'major'): void;
  cancelPendingPublish(targetId: string): void;
  clearAutoPublishSkip(): void;
  openIconTab(iconSetId: string, iconId: string, options?: { focus?: boolean }): string | null;
  closeIconTab(tabId: string): void;
  setActiveTab(tabId: string): void;
  generateVariantMatrix(
    iconId: string,
    options: {
      sizes: number[];
      weights: SymbolWeight[];
      scales: SymbolScale[];
      sourceVariantId?: string;
    },
  ): string[];
  upsertSymbolComponent(iconId: string, component: SymbolComponent): void;
  removeSymbolComponent(iconId: string, kind: SymbolComponent['kind']): void;
  removeSelectedLayers(): void;
  duplicateSelectedLayers(): void;
  copySelectedLayers(): void;
  pasteLayers(): void;
  reorderSelectedLayers(direction: 'up' | 'down' | 'front' | 'back'): void;
  moveLayerToIndex(layerId: string, index: number): void;
  pauseHistory(): void;
  resumeHistory(): void;
  commitHistory(label?: string): void;
  toggleNavPane(): void;
  toggleListPane(): void;
  setSelectedIconIds(ids: string[]): void;
  toggleIconSelection(iconId: string): void;
  clearIconSelection(): void;
  applyBoolean(mode: BooleanMode): Promise<void>;
  /**
   * W2-2 — drop the compound metadata on a layer, leaving the cached
   * `path.d` as a plain authored path. Destructive (the operand tree
   * is gone after this); the Inspector prompts before invoking.
   */
  flattenCompound(iconId: string, layerId: string): void;
  /**
   * W2-2 — convert a compound layer back into one sibling layer per
   * operand, preserving operand geometry. Non-destructive
   * alternative to `flattenCompound`; offered as the primary action
   * in the Inspector's Flatten dialog.
   */
  convertToGroup(iconId: string, layerId: string): void;
  /** Phase N: generate a derived variant (fill/slash/circle/square/badge). */
  applyDerivedVariant(
    iconId: string,
    spec: import('@/lib/schema/variant-derivation').DerivedVariantSpec,
  ): Promise<void>;
};

export type EditorStore = EditorState & EditorActions;

export type VariantInput = {
  id?: string;
  name?: string;
  size: number;
  viewBox?: [number, number, number, number];
  renderingMode?: RenderingMode;
  guideMasterId?: string;
  weight?: SymbolWeight;
  scale?: SymbolScale;
  sourceVariantId?: string;
  layers?: Record<string, Layer>;
};

export type VariantPatch = Partial<
  Pick<Variant, 'name' | 'size' | 'viewBox' | 'renderingMode' | 'weight' | 'scale' | 'variableValue' | 'weightControlPoints'>
>;

type LegacyVariant = Variant & {
  guideSetId?: string;
};

type LegacyIcon = Omit<Icon, 'variants'> & {
  variants: Record<string, LegacyVariant>;
  guides?: Record<string, GuideSet>;
};

type ProjectInput = Omit<Project, 'icons'> & {
  icons: Record<string, LegacyIcon>;
};

type LoadProjectOptions = {
  resetHistory?: boolean;
  markDirty?: boolean;
  keepTabs?: boolean;
};

type TemporalSnapshot = {
  workspace: Workspace | null;
  project: Project | null;
  activeIconSetId: string | null;
  isDirty: boolean;
  /**
   * The `editScope` at the time the snapshot was pushed. Restoring it on
   * undo / redo keeps history entries replay-correct: an edit authored in
   * guide scope is only re-applied to the master if the user is (or is
   * returned to) that master.
   */
  editScope: EditScope;
};

type TemporalState = {
  pastStates: TemporalSnapshot[];
  futureStates: TemporalSnapshot[];
  undo(): void;
  redo(): void;
  clear(): void;
  pause(): void;
  resume(): void;
  discard(): void;
  commit(_label?: string): void;
};

const initialState: EditorState = {
  workspace: null,
  project: null,
  activeIconSetId: null,
  isDirty: false,
  lastSavedAt: null,
  lastCheckpointAt: null,
  lastPublishedAt: null,
  lastPublishedVersion: null,
  currentIconId: null,
  currentVariantId: null,
  currentTypeId: null,
  selectedIconGuideIndex: null,
  selection: { layerIds: [], pointIds: [] },
  activeSnapGuides: [],
  snapEnabled: true,
  guidesVisible: true,
  guideStyle: 'subtle',
  viewport: { zoom: 12, panX: 0, panY: 0 },
  tool: 'select',
  renderingMode: 'multicolor',
  shapeSubTool: 'rectangle',
  shapePolygonSides: 5,
  shapeStarPoints: 5,
  editScope: { kind: 'icon' },
  pointMarquee: null,
  pointTransformLabel: null,
  pendingPenHandle: null,
  transitionPreview: null,
  selectedTransitionId: null,
  favorites: [],
  openTabs: [],
  activeTabId: null,
  isDeriving: false,
  pendingPublishes: [],
  skipNextAutoPublish: false,
  navPaneExpanded: false,
  listPaneExpanded: true,
  selectedIconIds: [],
  layerClipboard: [],
};

let currentState: EditorStore;
const listeners = new Set<() => void>();

const MAX_HISTORY = 100;
export const VARIANT_SIZE_PRESETS = [12, 16, 20, 24, 32, 48] as const;
let tracking = true;
let transactionBase: TemporalSnapshot | undefined;
const pastStates: TemporalSnapshot[] = [];
const futureStates: TemporalSnapshot[] = [];

function emit() {
  for (const l of listeners) l();
}

function normalizeSelection(selection: SelectionState): Required<SelectionState> {
  return {
    layerIds: Array.from(new Set(selection.layerIds)),
    pointIds: Array.from(new Set(selection.pointIds)),
    guideIndexes: Array.from(new Set(selection.guideIndexes ?? [])).sort((a, b) => a - b),
  };
}

function pushHistorySnapshot(
  workspace: Workspace | null,
  project: Project | null,
  activeIconSetId: string | null,
  isDirty: boolean,
  editScope: EditScope,
) {
  pastStates.push({ workspace, project, activeIconSetId, isDirty, editScope });
  if (pastStates.length > MAX_HISTORY) pastStates.shift();
  futureStates.length = 0;
}

function applySnapshot(snapshot: TemporalSnapshot) {
  // Restore the editScope this snapshot was captured under so an edit made
  // in guide scope replays into the right surface. Importantly, if the
  // snapshot's master has since been deleted, fall back to icon scope to
  // avoid routing writes into a missing master.
  const snapshotScope: EditScope =
    snapshot.editScope.kind === 'guideMaster' &&
    !snapshot.project?.guideMasters?.[snapshot.editScope.masterId]
      ? { kind: 'icon' }
      : snapshot.editScope;

  const variant = getVariantById(
    snapshot.project,
    currentState.currentIconId,
    currentState.currentVariantId,
  );
  currentState = {
    ...currentState,
    workspace: snapshot.workspace,
    project: snapshot.project,
    activeIconSetId: snapshot.activeIconSetId,
    isDirty: snapshot.isDirty,
    editScope: snapshotScope,
    currentTypeId: variant ? getVariantDefaultTypeId(variant) : null,
    renderingMode: getResolvedRenderingMode(variant),
    selection: { layerIds: [], pointIds: [] },
    activeSnapGuides: [],
    pointMarquee: null,
    pendingPenHandle: null,
    transitionPreview: null,
  };
  emit();
}

const temporalState: TemporalState = {
  pastStates,
  futureStates,
  undo() {
    const prev = pastStates.pop();
    if (!prev) return;

    futureStates.push({
      workspace: currentState.workspace,
      project: currentState.project,
      activeIconSetId: currentState.activeIconSetId,
      isDirty: currentState.isDirty,
      editScope: currentState.editScope,
    });
    applySnapshot(prev);
  },

  redo() {
    const next = futureStates.pop();
    if (!next) return;

    pastStates.push({
      workspace: currentState.workspace,
      project: currentState.project,
      activeIconSetId: currentState.activeIconSetId,
      isDirty: currentState.isDirty,
      editScope: currentState.editScope,
    });
    applySnapshot(next);
  },

  clear() {
    pastStates.length = 0;
    futureStates.length = 0;
    transactionBase = undefined;
    // Reset the tracking flag too. Otherwise a stuck-paused history from an
    // earlier boolean/derive operation (or a test that forgot to resume)
    // would silently swallow all subsequent mutations.
    tracking = true;
  },

  pause() {
    if (!tracking) return;
    tracking = false;
    transactionBase = {
      workspace: currentState.workspace,
      project: currentState.project,
      activeIconSetId: currentState.activeIconSetId,
      isDirty: currentState.isDirty,
      editScope: currentState.editScope,
    };
  },

  resume() {
    tracking = true;
  },

  discard() {
    if (transactionBase === undefined) return;
    currentState = {
      ...currentState,
      workspace: transactionBase.workspace,
      project: transactionBase.project,
      activeIconSetId: transactionBase.activeIconSetId,
      isDirty: transactionBase.isDirty,
    };
    tracking = true;
    transactionBase = undefined;
    emit();
  },

  commit(_label?: string) {
    if (transactionBase === undefined) return;
    if (
      transactionBase.workspace !== currentState.workspace ||
      transactionBase.project !== currentState.project ||
      transactionBase.activeIconSetId !== currentState.activeIconSetId ||
      transactionBase.isDirty !== currentState.isDirty
    ) {
      pushHistorySnapshot(
        transactionBase.workspace,
        transactionBase.project,
        transactionBase.activeIconSetId,
        transactionBase.isDirty,
        transactionBase.editScope,
      );
    }
    transactionBase = undefined;
  },
};

const editorStoreApi = {
  getState: () => currentState,
  setState: (
    updater: Partial<EditorStore> | ((s: EditorStore) => Partial<EditorStore> | EditorStore),
    replace = false,
  ) => {
    const prev = currentState;
    const nextPatch = typeof updater === 'function' ? updater(prev) : updater;
    const hasExplicitDirty = Object.prototype.hasOwnProperty.call(nextPatch, 'isDirty');
    let next = replace ? (nextPatch as EditorStore) : ({ ...prev, ...nextPatch } as EditorStore);

    if (
      next.workspace &&
      next.activeIconSetId &&
      next.project &&
      next.workspace.iconSets[next.activeIconSetId]
    ) {
      next = {
        ...next,
        workspace: replaceWorkspaceIconSet(next.workspace, next.activeIconSetId, next.project),
      } as EditorStore;
    }

    if (next.workspace && next.activeIconSetId && !next.project) {
      next = {
        ...next,
        project: getActiveIconSet(next.workspace, next.activeIconSetId),
      } as EditorStore;
    }

    if (next.activeTabId) {
      const activeTab = next.openTabs.find((tab) => tab.id === next.activeTabId);
      if (activeTab) {
        next = {
          ...next,
          openTabs: next.openTabs.map((tab) =>
            tab.id === next.activeTabId
              ? {
                  ...tab,
                  iconSetId: next.activeIconSetId ?? tab.iconSetId,
                  iconId: next.currentIconId ?? tab.iconId,
                  variantId: next.currentVariantId,
                }
              : tab,
          ),
        } as EditorStore;
      }
    }

    if (prev.project !== next.project && !hasExplicitDirty) {
      next = { ...next, isDirty: true };
    }

    if (prev.project !== next.project) {
      if (tracking) {
        pushHistorySnapshot(
          prev.workspace,
          prev.project,
          prev.activeIconSetId,
          prev.isDirty,
          prev.editScope,
        );
      } else if (transactionBase === undefined) {
        transactionBase = {
          workspace: prev.workspace,
          project: prev.project,
          activeIconSetId: prev.activeIconSetId,
          isDirty: prev.isDirty,
          editScope: prev.editScope,
        };
      }
    }

    currentState = next;
    emit();
  },

  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  temporal: {
    getState: () => temporalState,
  },
};

function resetHistoryForLoadedDocument() {
  temporalState.clear();
}

function migrateProjectForGuideMasters(project: ProjectInput): Project {
  const nextGuideMasters: Record<string, GuideMaster> = {
    ...(project.guideMasters ?? {}),
  };

  const nextIcons = Object.fromEntries(
    Object.entries(project.icons).map(([iconId, icon]) => {
      const variants = icon.variants;
      const guideRefsBySetId = new Map<string, LegacyVariant[]>();

      for (const variant of Object.values(variants)) {
        if (!variant.guideSetId) continue;
        const bucket = guideRefsBySetId.get(variant.guideSetId) ?? [];
        bucket.push(variant);
        guideRefsBySetId.set(variant.guideSetId, bucket);
      }

      for (const [guideSetId, guideSet] of Object.entries(icon.guides ?? {})) {
        const referencingVariants = guideRefsBySetId.get(guideSetId) ?? [];
        if (referencingVariants.length === 0) {
          const fallbackVariant = Object.values(variants)[0];
          const fallbackSize = fallbackVariant?.size ?? 24;
          const fallbackViewBox = fallbackVariant?.viewBox ?? [0, 0, fallbackSize, fallbackSize];
          const fallbackId = ensureUniqueGuideMasterId(guideSetId, nextGuideMasters, fallbackSize);
          nextGuideMasters[fallbackId] = {
            id: fallbackId,
            name: buildGuideMasterName(guideSetId, fallbackSize),
            targetSize: fallbackSize,
            viewBox: fallbackViewBox,
            items: [],
            layers: {},
          };
          continue;
        }

        const variantsBySize = new Map<number, LegacyVariant>();
        for (const variant of referencingVariants) {
          if (!variantsBySize.has(variant.size)) {
            variantsBySize.set(variant.size, variant);
          }
        }

        for (const [size, variant] of variantsBySize) {
          const guideMasterId = ensureUniqueGuideMasterId(
            guideSetId,
            nextGuideMasters,
            size,
            variantsBySize.size > 1,
          );
          nextGuideMasters[guideMasterId] = {
            id: guideMasterId,
            name: buildGuideMasterName(guideSetId, size),
            targetSize: size,
            viewBox: variant.viewBox,
            items: guideSet.items,
            layers: {},
          };
        }
      }

      const migratedVariants = Object.fromEntries(
        Object.entries(variants).map(([variantId, variant]) => {
          const {
            guideSetId: legacyGuideSetId,
            name,
            guideMasterId,
            ...rest
          } = variant;
          const targetGuideMaster =
            guideMasterId ??
            (legacyGuideSetId
              ? Object.values(nextGuideMasters).find(
                  (master) =>
                    master.targetSize === variant.size &&
                    master.name === buildGuideMasterName(legacyGuideSetId, variant.size),
                )?.id
              : undefined) ??
            Object.values(nextGuideMasters).find((master) => master.targetSize === variant.size)
              ?.id;

          return [
            variantId,
            {
              ...rest,
              name: name ?? String(variant.size),
              guideMasterId: targetGuideMaster,
            },
          ];
        }),
      ) as Icon['variants'];
      const { guides: _guides, ...restIcon } = icon;

      return [
        iconId,
        {
          ...restIcon,
          variants: migratedVariants,
        },
      ];
    }),
  ) as Project['icons'];

  // Backfill `layers: {}` on any pre-existing guide masters that were loaded
  // from an older project JSON. New authoring on canvas happens through the
  // `layers` field; legacy `items` still render for snap.
  for (const [masterId, master] of Object.entries(nextGuideMasters)) {
    if (!master.layers) {
      nextGuideMasters[masterId] = { ...master, layers: {} };
    }
  }

  return {
    ...project,
    icons: nextIcons,
    guideMasters: Object.keys(nextGuideMasters).length > 0 ? nextGuideMasters : undefined,
  };
}

/**
 * Types are universal within an IconSet (like theme tokens). This migration
 * lifts authored types from individual variants into an IconSet-level catalog,
 * then backfills every variant so that every type in the catalog has a
 * per-variant layer entry. Variants missing a type get its layers cloned
 * from their own default type — this matches `addType`'s runtime behavior.
 */
function ensureUniversalTypes(project: Project): Project {
  // Union all authored type ids across every variant.
  const catalog: Record<string, IconSetTypeDef> = { ...(project.types ?? {}) };
  for (const icon of Object.values(project.icons)) {
    for (const variant of Object.values(icon.variants)) {
      if (!variant.types) continue;
      for (const typeId of Object.keys(variant.types)) {
        if (!catalog[typeId]) catalog[typeId] = { id: typeId };
      }
    }
  }

  const catalogIds = Object.keys(catalog);

  // If there are no authored types anywhere, leave the catalog empty and
  // let variants carry only their implicit `default` fallback.
  const nextIcons = Object.fromEntries(
    Object.entries(project.icons).map(([iconId, icon]) => {
      const nextVariants = Object.fromEntries(
        Object.entries(icon.variants).map(([variantId, variant]) => {
          if (catalogIds.length === 0) {
            return [variantId, variant];
          }
          const next = normalizeVariant(variant);
          const defaultId = getVariantDefaultTypeId(next);
          const sourceType = next.types?.[defaultId];
          const sourceLayers = sourceType?.layers ?? next.layers ?? {};
          const sourceTopology = sourceType?.topology ?? next.topology;

          const mergedTypes: Record<string, IconType> = { ...(next.types ?? {}) };
          let changed = false;
          for (const typeId of catalogIds) {
            if (mergedTypes[typeId]) continue;
            mergedTypes[typeId] = {
              id: typeId,
              layers: structuredClone(sourceLayers),
              topology: sourceTopology ? structuredClone(sourceTopology) : undefined,
            };
            changed = true;
          }
          if (!changed) return [variantId, next];
          return [
            variantId,
            normalizeVariant({
              ...next,
              types: mergedTypes,
            }),
          ];
        }),
      );
      return [iconId, { ...icon, variants: nextVariants }];
    }),
  ) as Project['icons'];

  return {
    ...project,
    types: catalogIds.length > 0 ? catalog : project.types,
    icons: nextIcons,
  };
}

/**
 * Clone the layer geometry of a variant's default type, so a freshly-created
 * universal type can slot in with meaningful starting content on every icon.
 */
function cloneVariantDefaultAsType(variant: Variant, typeId: string): Variant {
  const defaultId = getVariantDefaultTypeId(variant);
  const source = variant.types?.[defaultId];
  const sourceLayers = source?.layers ?? variant.layers ?? {};
  const sourceTopology = source?.topology ?? variant.topology;
  return normalizeVariant({
    ...variant,
    types: {
      ...(variant.types ?? {}),
      [typeId]: {
        id: typeId,
        layers: structuredClone(sourceLayers),
        topology: sourceTopology ? structuredClone(sourceTopology) : undefined,
      },
    },
  });
}

function ensureUniqueGuideMasterId(
  baseId: string,
  guideMasters: Record<string, GuideMaster>,
  targetSize: number,
  preferSizedId = false,
): string {
  const sizedId = `${baseId}-${targetSize}`;
  const candidates = preferSizedId ? [sizedId, baseId] : [baseId, sizedId];

  for (const candidate of candidates) {
    const existing = guideMasters[candidate];
    if (!existing || existing.targetSize === targetSize) {
      return candidate;
    }
  }

  let suffix = 2;
  while (true) {
    const candidate = `${sizedId}-${suffix}`;
    const existing = guideMasters[candidate];
    if (!existing || existing.targetSize === targetSize) {
      return candidate;
    }
    suffix += 1;
  }
}

function buildGuideMasterName(guideSetId: string, targetSize: number) {
  const normalized = guideSetId
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return normalized ? `${targetSize}px ${normalized}` : `${targetSize}px Guide`;
}

function cloneLayer(layer: Layer): Layer {
  return {
    ...layer,
    path: layer.path ? { ...layer.path } : undefined,
    style: { ...layer.style },
    transform: layer.transform ? { ...layer.transform } : undefined,
    importMeta: layer.importMeta
      ? {
          ...layer.importMeta,
          unsupported: layer.importMeta.unsupported?.map((entry) => ({
            ...entry,
            attributes: entry.attributes ? { ...entry.attributes } : undefined,
          })),
        }
      : undefined,
  };
}

function cloneLayers(layers: Record<string, Layer>): Record<string, Layer> {
  return Object.fromEntries(
    Object.entries(layers).map(([layerId, layer]) => [layerId, cloneLayer(layer)]),
  );
}

function cloneTopology(topology: TopologyContract | undefined): TopologyContract | undefined {
  if (!topology) return undefined;
  return {
    ...topology,
    layerPairs: topology.layerPairs.map((pair) => ({
      ...pair,
      commandSignature: [...pair.commandSignature],
      closed: [...pair.closed],
    })),
  };
}

function getVariantById(
  project: Project | null,
  iconId: string | null | undefined,
  variantId: string | null | undefined,
): Variant | null {
  if (!project || !iconId || !variantId) return null;
  return project.icons[iconId]?.variants[variantId] ?? null;
}

function buildVariantName(size: number, existingNames: string[], preferredName?: string): string {
  const baseName = (preferredName?.trim() || String(size)).slice(0, 64);
  if (!existingNames.includes(baseName)) return baseName;

  let counter = 2;
  let nextName = `${baseName} ${counter}`;
  while (existingNames.includes(nextName)) {
    counter += 1;
    nextName = `${baseName} ${counter}`;
  }
  return nextName;
}

function buildVariantId(size: number, existingIds: string[]): string {
  return ensureUniqueRecordId(`v${Math.round(size)}`, existingIds);
}

function scaleViewBoxToSize(
  sourceViewBox: [number, number, number, number],
  size: number,
): [number, number, number, number] {
  const sourceSize = Math.max(sourceViewBox[2], sourceViewBox[3], 1);
  const scale = size / sourceSize;
  return [
    Number((sourceViewBox[0] * scale).toFixed(3)),
    Number((sourceViewBox[1] * scale).toFixed(3)),
    Number((sourceViewBox[2] * scale).toFixed(3)),
    Number((sourceViewBox[3] * scale).toFixed(3)),
  ];
}

function withLegacyIconView(icon: Icon): Icon {
  return {
    ...icon,
    variants: Object.fromEntries(
      Object.entries(icon.variants).map(([variantId, variant]) => [
        variantId,
        normalizeVariant(variant),
      ]),
    ),
  };
}

function withLegacyProjectView(project: Project): Project {
  return {
    ...project,
    icons: Object.fromEntries(
      Object.entries(project.icons).map(([iconId, icon]) => [iconId, withLegacyIconView(icon)]),
    ),
  };
}

function withLegacyWorkspaceView(workspace: Workspace): Workspace {
  return {
    ...workspace,
    iconSets: Object.fromEntries(
      Object.entries(workspace.iconSets).map(([iconSetId, iconSet]) => [
        iconSetId,
        withLegacyProjectView(iconSet),
      ]),
    ),
  };
}

/**
 * Rewrites ID-based layer references inside a cloned layer so that a clone
 * group (paste / duplicate of a mask + masked-layer set) stays internally
 * self-contained instead of pointing back at the originals.
 *
 * The only layer-to-layer id reference in the schema today is
 * `clipPathLayerId` (see `lib/schema/types.ts:180`). `groupId` is a free-form
 * grouping key rather than a layer id, so it is intentionally left alone.
 * `isClipMask` is a boolean flag and needs no remapping. If new reference
 * fields are added to `Layer`, extend this helper in lockstep and add a
 * regression test alongside `tests/paste-clone-clip-remap.test.ts`.
 */
function remapLayerReferences(
  layer: Layer,
  idMap: Map<string, string>,
): Layer {
  if (!layer.clipPathLayerId) return layer;
  const remapped = idMap.get(layer.clipPathLayerId);
  if (!remapped) return layer;
  return { ...layer, clipPathLayerId: remapped };
}

function replaceVariantLayers(
  icon: Icon,
  variantId: string,
  nextLayers: Record<string, Layer>,
  nextTopology?: TopologyContract | undefined,
): Icon {
  const variant = icon.variants[variantId];
  if (!variant) return icon;

  return {
    ...icon,
    variants: {
      ...icon.variants,
      [variantId]: normalizeVariant({
        ...variant,
        layers: nextLayers,
        topology: nextTopology !== undefined ? nextTopology : variant.topology,
      }),
    },
  };
}

/**
 * Read the layer record the editor is currently operating on. In icon scope
 * this is the active variant's layers; in guide scope it is the bound
 * master's `layers`. Returns `null` when there is no valid scope (e.g. no
 * project loaded, or the referenced master/icon/variant has gone missing).
 */
function readCurrentLayers(s: EditorState): Record<string, Layer> | null {
  if (!s.project) return null;
  if (s.editScope.kind === 'guideMaster') {
    const master = s.project.guideMasters?.[s.editScope.masterId];
    return master?.layers ?? null;
  }
  if (!s.currentIconId || !s.currentVariantId) return null;
  const icon = s.project.icons[s.currentIconId];
  return icon?.variants[s.currentVariantId]?.layers ?? null;
}

/**
 * Chokepoint for every layer-writing store action. The `mutate` function
 * takes the current layer record and returns a fully-formed replacement
 * (it must preserve layer identity — primitive-clearing is the caller's
 * responsibility via `patchLayer`'s invariant).
 *
 * If `mutate` returns the input record (or throws), no state patch is
 * produced. Otherwise the helper returns a `Partial<EditorState>` the
 * caller can fold into `setState((s) => ({ ...s, ...patch }))`.
 *
 * In guide scope the write lands on `master.layers`; the topology-lock
 * check (icon-scope-only) is skipped.
 */
function writeCurrentLayers(
  s: EditorState,
  mutate: (prev: Record<string, Layer>) => Record<string, Layer>,
  opts: { nextTopology?: TopologyContract | undefined } = {},
): Partial<EditorState> | null {
  if (!s.project) return null;

  if (s.editScope.kind === 'guideMaster') {
    const masterId = s.editScope.masterId;
    const master = s.project.guideMasters?.[masterId];
    if (!master) {
      // Deletion race: a pending drag/commit targeted a master that no
      // longer exists. Leave the project untouched; `removeGuideMaster`
      // already snapped the scope back to icon.
      if (typeof console !== 'undefined') {
        console.warn(
          `[editor-store] Dropped guide-master write — master "${masterId}" no longer exists.`,
        );
      }
      return null;
    }
    const prev = master.layers ?? {};
    const next = mutate(prev);
    if (next === prev) return null;
    return {
      project: {
        ...s.project,
        meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
        guideMasters: {
          ...s.project.guideMasters,
          [master.id]: { ...master, layers: next },
        },
      },
    };
  }

  if (!s.currentIconId || !s.currentVariantId) return null;
  const icon = s.project.icons[s.currentIconId];
  if (!icon) return null;
  const variant = icon.variants[s.currentVariantId];
  if (!variant) return null;
  const next = mutate(variant.layers);
  if (next === variant.layers) return null;

  // Topology lock is an icon-scope invariant; masters don't carry it.
  const nextTopology =
    'nextTopology' in opts && opts.nextTopology !== undefined
      ? opts.nextTopology
      : variant.topology;

  return {
    project: {
      ...s.project,
      icons: {
        ...s.project.icons,
        [s.currentIconId]: replaceVariantLayers(icon, s.currentVariantId, next, nextTopology),
      },
    },
  };
}

function getFirstIconId(project: Project | null | undefined) {
  return project ? (Object.keys(project.icons)[0] ?? null) : null;
}

function getFirstVariantId(project: Project | null | undefined, iconId: string | null | undefined) {
  if (!project || !iconId) return null;
  return Object.keys(project.icons[iconId]?.variants ?? {})[0] ?? null;
}

function buildEditorTarget(
  project: Project | null | undefined,
  requestedIconId?: string | null,
  previousTypeId?: string | null,
) {
  const iconId =
    requestedIconId && project?.icons[requestedIconId] ? requestedIconId : getFirstIconId(project);
  const variantId = getFirstVariantId(project, iconId);
  const variant =
    variantId && iconId && project ? project.icons[iconId]?.variants[variantId] : null;

  // Prefer the previously-selected universal type if the IconSet still has it
  // in its catalog (types are universal across icons, so this carries through).
  const preserved =
    previousTypeId && project?.types?.[previousTypeId] ? previousTypeId : null;

  return {
    iconId,
    variantId,
    currentTypeId: preserved ?? (variant ? getVariantDefaultTypeId(variant) : null),
    renderingMode: getResolvedRenderingMode(variant),
  };
}

function createEmptyIconSet(name: string, now = new Date().toISOString()): IconSet {
  const defaultGuideMaster = getDefaultGuideMaster(24);
  return {
    version: '1.0',
    meta: { name, createdAt: now, updatedAt: now },
    icons: {},
    guideMasters: {
      [defaultGuideMaster.id]: defaultGuideMaster,
    },
  };
}

function createBlankIcon(
  project: Project,
  options?: { name?: string; size?: number },
): Icon {
  const size = clampInteger(options?.size ?? 24, 1);
  const baseName = options?.name?.trim() || 'New Icon';
  const name = buildDisplayName(baseName, Object.values(project.icons).map((icon) => icon.name));
  const variantId = buildVariantId(size, []);
  const guideMasterId =
    Object.values(project.guideMasters ?? {}).find((master) => master.targetSize === size)?.id ??
    Object.values(project.guideMasters ?? {})[0]?.id;

  // Preexisting bug (surfaced by the default-type-rename work): this
  // helper previously called `normalizeVariant({ layers: {} })` which
  // silently synthesizes a `default` type entry and ignores the IconSet
  // catalog. New icons created into a project that already has custom
  // types (e.g. `line`, `filled`) would only carry the literal `default`
  // key, visually rendering as a "missing type" once the user switched
  // to any other tab.
  //
  // Fix: seed every catalog type onto the fresh variant so a newly
  // created icon matches the universal-types invariant from day one.
  const catalogTypeIds = Object.keys(project.types ?? {});
  const seededTypes: Record<string, IconType> = {};
  for (const typeId of catalogTypeIds) {
    seededTypes[typeId] = { id: typeId, layers: {} };
  }
  const baseVariant: Variant = {
    id: variantId,
    name: String(size),
    size,
    viewBox: [0, 0, size, size],
    guideMasterId,
    layers: {},
    ...(catalogTypeIds.length > 0
      ? {
          defaultType: catalogTypeIds[0],
          types: seededTypes,
        }
      : {}),
  };

  return {
    id: toKebabCase(name) || 'new-icon',
    name,
    variants: {
      [variantId]: normalizeVariant(baseVariant),
    },
  };
}

function buildWorkspaceState(
  workspace: Workspace,
  activeIconSetId?: string | null,
  options?: { requestedIconId?: string | null; keepTabs?: boolean; previousState?: EditorStore },
): Partial<EditorStore> {
  const resolvedIconSetId = activeIconSetId ?? getFirstIconSetId(workspace);
  const project = getActiveIconSet(workspace, resolvedIconSetId);
  const target = buildEditorTarget(
    project,
    options?.requestedIconId,
    options?.previousState?.currentTypeId,
  );

  const baseState = options?.previousState;
  const existingTabs = options?.keepTabs ? (baseState?.openTabs ?? []) : [];
  const activeTabId = options?.keepTabs ? (baseState?.activeTabId ?? null) : null;

  return {
    workspace,
    project,
    activeIconSetId: resolvedIconSetId,
    currentIconId: target.iconId,
    currentVariantId: target.variantId,
    currentTypeId: target.currentTypeId,
    renderingMode: target.renderingMode,
    selectedIconGuideIndex: null,
    selection: { layerIds: [], pointIds: [] },
    activeSnapGuides: [],
    snapEnabled: true,
    guidesVisible: true,
    guideStyle: 'subtle',
    viewport: { zoom: 12, panX: 0, panY: 0 },
    editScope: { kind: 'icon' },
    pointMarquee: null,
    pointTransformLabel: null,
    pendingPenHandle: null,
    transitionPreview: null,
    favorites: baseState?.favorites ?? [],
    selectedTransitionId: null,
    openTabs: existingTabs,
    activeTabId,
  };
}

function createTabId(iconSetId: string, iconId: string) {
  return `${iconSetId}::${iconId}`;
}

function getResolvedRenderingMode(
  variant: Pick<Variant, 'renderingMode'> | null | undefined,
): RenderingMode {
  return variant?.renderingMode ?? 'multicolor';
}

function createActions(): EditorActions {
  return {
    loadWorkspace(workspace, options) {
      const { resetHistory = true, markDirty = false, keepTabs = false } = options ?? {};
      const migratedIconSets = Object.fromEntries(
        Object.entries(workspace.iconSets).map(([iconSetId, iconSet]) => [
          iconSetId,
          ensureUniversalTypes(migrateProjectForGuideMasters(iconSet)),
        ]),
      );
      const migratedWorkspace: Workspace = withLegacyWorkspaceView({
        ...workspace,
        iconSets: migratedIconSets,
        activeIconSetId:
          workspace.activeIconSetId && migratedIconSets[workspace.activeIconSetId]
            ? workspace.activeIconSetId
            : (getFirstIconSetId({
                ...workspace,
                iconSets: migratedIconSets,
              }) ?? undefined),
      });

      editorStoreApi.setState({
        ...initialState,
        ...buildWorkspaceState(migratedWorkspace, migratedWorkspace.activeIconSetId, {
          previousState: editorStoreApi.getState(),
          keepTabs,
        }),
        isDirty: markDirty,
      });
      if (resetHistory) {
        resetHistoryForLoadedDocument();
      }
    },

    loadProject(project, options) {
      const workspace = withLegacyWorkspaceView(
        createWorkspaceFromProject(
          withLegacyProjectView(ensureUniversalTypes(migrateProjectForGuideMasters(project))),
        ),
      );
      const { resetHistory = true, markDirty = false, keepTabs = false } = options ?? {};
      editorStoreApi.setState({
        ...initialState,
        ...buildWorkspaceState(workspace, workspace.activeIconSetId, {
          previousState: editorStoreApi.getState(),
          keepTabs,
        }),
        isDirty: markDirty,
      });
      if (resetHistory) {
        resetHistoryForLoadedDocument();
      }
    },

    newProject() {
      const now = new Date().toISOString();
      const workspace: Workspace = {
        version: '2.0',
        meta: { name: 'Untitled Workspace', createdAt: now, updatedAt: now },
        iconSets: {
          'icon-set-1': createEmptyIconSet('Untitled Set', now),
        },
        activeIconSetId: 'icon-set-1',
      };
      editorStoreApi.setState({
        ...initialState,
        ...buildWorkspaceState(workspace, workspace.activeIconSetId, {
          previousState: editorStoreApi.getState(),
        }),
        isDirty: false,
      });
      resetHistoryForLoadedDocument();
    },

    markSaved(_updatedAt) {
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        return {
          isDirty: false,
          lastSavedAt: Date.now(),
        };
      });
    },

    markCheckpointSaved(at) {
      editorStoreApi.setState(() => ({
        lastCheckpointAt: at ?? Date.now(),
      }));
    },

    markPublished(version, at) {
      editorStoreApi.setState(() => ({
        lastPublishedAt: at ?? Date.now(),
        lastPublishedVersion: version,
      }));
    },

    createBlankIcon(options) {
      const state = editorStoreApi.getState();
      if (!state.project) return null;

      const icon = createBlankIcon(state.project, options);
      const nextIconId = ensureUniqueIconId(icon.id, Object.keys(state.project.icons));
      const nextIcon =
        nextIconId === icon.id
          ? icon
          : {
              ...icon,
              id: nextIconId,
            };
      const normalizedNextIcon = withLegacyIconView(nextIcon);
      const nextVariantId = Object.keys(normalizedNextIcon.variants)[0] ?? null;

      editorStoreApi.setState((s) => ({
        project: {
          ...s.project!,
          meta: { ...s.project!.meta, updatedAt: new Date().toISOString() },
          icons: {
            ...s.project!.icons,
            [nextIconId]: normalizedNextIcon,
          },
        },
        currentIconId: nextIconId,
        currentVariantId: nextVariantId,
        currentTypeId: nextVariantId ? getVariantDefaultTypeId(normalizedNextIcon.variants[nextVariantId]!) : null,
        renderingMode: getResolvedRenderingMode(
          nextVariantId ? normalizedNextIcon.variants[nextVariantId] : null,
        ),
        selection: { layerIds: [], pointIds: [] },
        activeSnapGuides: [],
        pointMarquee: null,
        pointTransformLabel: null,
        transitionPreview: null,
      }));

      return nextIconId;
    },

    insertIcon(icon) {
      editorStoreApi.setState((s) => {
        const now = new Date().toISOString();
        const project =
          s.project ??
          ({
            version: '1.0',
            meta: { name: 'Untitled', createdAt: now, updatedAt: now },
            icons: {},
          } satisfies Project);

        const nextIconId = ensureUniqueIconId(icon.id, Object.keys(project.icons));
        const nextIcon =
          nextIconId === icon.id
            ? icon
            : {
                ...icon,
                id: nextIconId,
              };
        const normalizedNextIcon = withLegacyIconView(nextIcon);
        const nextVariantId = Object.keys(normalizedNextIcon.variants)[0] ?? null;

        return {
          project: {
            ...project,
            meta: { ...project.meta, updatedAt: now },
            icons: {
              ...project.icons,
              [nextIconId]: normalizedNextIcon,
            },
          },
          currentIconId: nextIconId,
          currentVariantId: nextVariantId,
          currentTypeId: nextVariantId ? getVariantDefaultTypeId(normalizedNextIcon.variants[nextVariantId]!) : null,
          renderingMode: getResolvedRenderingMode(
            nextVariantId ? normalizedNextIcon.variants[nextVariantId] : null,
          ),
          selection: { layerIds: [], pointIds: [] },
          activeSnapGuides: [],
          pointMarquee: null,
          pointTransformLabel: null,
          transitionPreview: null,
        };
      });
    },

    renameIcon(iconId, name) {
      const trimmed = name.trim();
      if (!trimmed) return;
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        const icon = s.project.icons[iconId];
        if (!icon || icon.name === trimmed) return s;

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...icon,
                name: trimmed,
              },
            },
          },
        };
      });
    },

    duplicateIcon(iconId) {
      let createdIconId: string | null = null;
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        const icon = s.project.icons[iconId];
        if (!icon) return s;

        const duplicate = withLegacyIconView(structuredClone(icon) as Icon);
        const nextIconId = ensureUniqueIconId(`${icon.id}-copy`, Object.keys(s.project.icons));
        const nextIconName = buildDisplayName(`${icon.name} Copy`, Object.values(s.project.icons).map((entry) => entry.name));
        duplicate.id = nextIconId;
        duplicate.name = nextIconName;

        const nextVariantId = Object.keys(duplicate.variants)[0] ?? null;
        createdIconId = nextIconId;

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            icons: {
              ...s.project.icons,
              [nextIconId]: duplicate,
            },
          },
          currentIconId: nextIconId,
          currentVariantId: nextVariantId,
          currentTypeId: nextVariantId ? getVariantDefaultTypeId(duplicate.variants[nextVariantId]!) : null,
          renderingMode: getResolvedRenderingMode(nextVariantId ? duplicate.variants[nextVariantId] : null),
          selection: { layerIds: [], pointIds: [] },
          activeSnapGuides: [],
          pointMarquee: null,
          pointTransformLabel: null,
          transitionPreview: null,
        };
      });

      return createdIconId;
    },

    removeIcon(iconId) {
      editorStoreApi.setState((s) => {
        if (!s.project?.icons[iconId]) return s;

        const nextIcons = { ...s.project.icons };
        delete nextIcons[iconId];

        const nextIconId =
          s.currentIconId === iconId ? Object.keys(nextIcons)[0] ?? null : s.currentIconId;
        const nextVariantId = getFirstVariantId({ ...s.project, icons: nextIcons }, nextIconId);
        const nextTabs = s.openTabs.filter((tab) => tab.iconId !== iconId);
        const nextActiveTabId =
          s.activeTabId && nextTabs.some((tab) => tab.id === s.activeTabId)
            ? s.activeTabId
            : nextTabs[0]?.id ?? null;

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            icons: nextIcons,
          },
          currentIconId: nextIconId,
          currentVariantId: nextVariantId,
          currentTypeId: nextIconId && nextVariantId ? getVariantDefaultTypeId(nextIcons[nextIconId]!.variants[nextVariantId]!) : null,
          renderingMode: getResolvedRenderingMode(
            nextIconId && nextVariantId ? nextIcons[nextIconId]?.variants[nextVariantId] : null,
          ),
          openTabs: nextTabs,
          activeTabId: nextActiveTabId,
          selectedIconIds: s.selectedIconIds.filter((id) => id !== iconId),
          selection: { layerIds: [], pointIds: [] },
          activeSnapGuides: [],
          pointMarquee: null,
          pointTransformLabel: null,
          transitionPreview: null,
        };
      });
    },

    addVariant(iconId, variantInput) {
      editorStoreApi.setState((s) => {
        // Icon-scope only: variants belong to icons, not masters.
        if (s.editScope.kind !== 'icon') return s;
        if (!s.project) return s;
        const icon = s.project.icons[iconId];
        if (!icon) return s;
        if (!Number.isFinite(variantInput.size) || variantInput.size <= 0) return s;

        const sourceVariantId =
          variantInput.sourceVariantId ??
          (s.currentIconId === iconId ? s.currentVariantId : null) ??
          Object.keys(icon.variants)[0] ??
          null;
        const sourceVariant = sourceVariantId ? icon.variants[sourceVariantId] : null;
        if (!sourceVariant) return s;

        const nextVariantId = variantInput.id
          ? ensureUniqueRecordId(variantInput.id, Object.keys(icon.variants))
          : buildVariantId(variantInput.size, Object.keys(icon.variants));
        const nextVariantName = buildVariantName(
          variantInput.size,
          Object.values(icon.variants).map((variant) => variant.name ?? String(variant.size)),
          variantInput.name,
        );
        const nextLayers = cloneLayers(variantInput.layers ?? sourceVariant.layers);
        const nextTopology = cloneTopology(sourceVariant.topology);
        const nextViewBox =
          variantInput.viewBox && variantInput.viewBox[2] > 0 && variantInput.viewBox[3] > 0
            ? variantInput.viewBox
            : scaleViewBoxToSize(sourceVariant.viewBox, variantInput.size);

        // Preexisting bug (surfaced by the default-type-rename work): the
        // previous implementation only cloned `sourceVariant.layers` into
        // `normalizeVariant({ layers, ... })`, which silently dropped
        // every non-default type entry on the source. A project with
        // types `line`, `filled`, `colored` would see all three erased
        // the moment the user added a new size variant. Clone the full
        // per-type map too.
        const nextTypes: Record<string, IconType> | undefined = sourceVariant.types
          ? Object.fromEntries(
              Object.entries(sourceVariant.types).map(([typeId, iconType]) => [
                typeId,
                {
                  id: typeId,
                  layers: cloneLayers(iconType.layers),
                  topology: iconType.topology ? cloneTopology(iconType.topology) : undefined,
                },
              ]),
            )
          : undefined;

        const nextVariant: Variant = normalizeVariant({
          id: nextVariantId,
          name: nextVariantName,
          size: variantInput.size,
          viewBox: nextViewBox,
          renderingMode:
            variantInput.renderingMode ?? sourceVariant.renderingMode ?? s.renderingMode,
          guideMasterId:
            variantInput.guideMasterId ??
            sourceVariant.guideMasterId ??
            Object.values(s.project.guideMasters ?? {}).find(
              (master) => master.targetSize === variantInput.size,
            )?.id,
          weight: variantInput.weight ?? sourceVariant.weight,
          scale: variantInput.scale ?? sourceVariant.scale,
          layers: nextLayers,
          topology: nextTopology,
          defaultType: sourceVariant.defaultType,
          types: nextTypes,
        });

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...icon,
                variants: {
                  ...icon.variants,
                  [nextVariantId]: nextVariant,
                },
              },
            },
          },
          currentIconId: iconId,
          currentVariantId: nextVariantId,
          currentTypeId: getVariantDefaultTypeId(nextVariant),
          renderingMode: getResolvedRenderingMode(nextVariant),
          selection: { layerIds: [], pointIds: [] },
          activeSnapGuides: [],
          selectedIconGuideIndex: null,
          pointMarquee: null,
          pointTransformLabel: null,
        };
      });
    },

    removeVariant(iconId, variantId) {
      editorStoreApi.setState((s) => {
        if (s.editScope.kind !== 'icon') return s;
        if (!s.project) return s;
        const icon = s.project.icons[iconId];
        if (!icon || !icon.variants[variantId]) return s;

        const variantIds = Object.keys(icon.variants);
        if (variantIds.length <= 1) return s;

        const nextVariants = { ...icon.variants };
        delete nextVariants[variantId];

        const fallbackVariantId =
          s.currentVariantId === variantId
            ? (Object.keys(nextVariants)[0] ?? null)
            : s.currentVariantId;
        const fallbackVariant = fallbackVariantId ? nextVariants[fallbackVariantId] : null;

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...icon,
                variants: nextVariants,
              },
            },
          },
          currentVariantId: fallbackVariantId,
          renderingMode: getResolvedRenderingMode(fallbackVariant),
          selection:
            s.currentVariantId === variantId ? { layerIds: [], pointIds: [] } : s.selection,
          activeSnapGuides: s.currentVariantId === variantId ? [] : s.activeSnapGuides,
          selectedIconGuideIndex:
            s.currentVariantId === variantId ? null : s.selectedIconGuideIndex,
          pointMarquee: s.currentVariantId === variantId ? null : s.pointMarquee,
          pointTransformLabel: s.currentVariantId === variantId ? null : s.pointTransformLabel,
        };
      });
    },

    patchVariant(iconId, variantId, patch) {
      editorStoreApi.setState((s) => {
        if (s.editScope.kind !== 'icon') return s;
        if (!s.project) return s;
        const icon = s.project.icons[iconId];
        const variant = icon?.variants[variantId];
        if (!icon || !variant) return s;

        const nextSize =
          patch.size !== undefined && Number.isFinite(patch.size) && patch.size > 0
            ? patch.size
            : variant.size;
        const nextViewBox =
          patch.viewBox && patch.viewBox[2] > 0 && patch.viewBox[3] > 0
            ? patch.viewBox
            : variant.viewBox;
        const nextRenderingMode = patch.renderingMode ?? variant.renderingMode;
        const nextWeight = patch.weight ?? variant.weight;
        const nextScale = patch.scale ?? variant.scale;
        const nextWeightControlPoints =
          'weightControlPoints' in patch
            ? patch.weightControlPoints
            : variant.weightControlPoints;
        const nextName = 'name' in patch ? patch.name : variant.name;

        if (
          nextSize === variant.size &&
          nextViewBox === variant.viewBox &&
          nextRenderingMode === variant.renderingMode &&
          nextWeight === variant.weight &&
          nextScale === variant.scale &&
          nextWeightControlPoints === variant.weightControlPoints &&
          nextName === variant.name
        ) {
          return s;
        }

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...icon,
                variants: {
                  ...icon.variants,
                  [variantId]: {
                    ...variant,
                    name: nextName,
                    size: nextSize,
                    viewBox: nextViewBox,
                    renderingMode: nextRenderingMode,
                    weight: nextWeight,
                    scale: nextScale,
                    weightControlPoints: nextWeightControlPoints,
                  },
                },
              },
            },
          },
          renderingMode:
            s.currentIconId === iconId && s.currentVariantId === variantId
              ? getResolvedRenderingMode({ renderingMode: nextRenderingMode })
              : s.renderingMode,
        };
      });
    },

    addEffect(iconId, effect) {
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        const icon = s.project.icons[iconId];
        if (!icon) return s;

        const current = icon.effects ?? {};
        const nextId = ensureUniqueRecordId(effect.id, Object.keys(current));
        const nextEffect = nextId === effect.id ? effect : { ...effect, id: nextId };

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...icon,
                effects: {
                  ...current,
                  [nextEffect.id]: nextEffect,
                },
              },
            },
          },
        };
      });
    },

    removeEffect(iconId, effectId) {
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        const icon = s.project.icons[iconId];
        if (!icon?.effects?.[effectId]) return s;

        const nextEffects = { ...icon.effects };
        delete nextEffects[effectId];

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...icon,
                effects: nextEffects,
              },
            },
          },
        };
      });
    },

    patchEffect(iconId, effectId, patch) {
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        const icon = s.project.icons[iconId];
        const effect = icon?.effects?.[effectId];
        if (!icon || !effect) return s;

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...icon,
                effects: {
                  ...(icon.effects ?? {}),
                  [effectId]: {
                    ...effect,
                    ...patch,
                  },
                },
              },
            },
          },
        };
      });
    },

    duplicateLayersToVariant(iconId, fromVariantId, toVariantId) {
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        const icon = s.project.icons[iconId];
        const fromVariant = icon?.variants[fromVariantId];
        const toVariant = icon?.variants[toVariantId];
        if (!icon || !fromVariant || !toVariant) return s;

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...icon,
                variants: {
                  ...icon.variants,
                  [toVariantId]: {
                    ...toVariant,
                    layers: cloneLayers(fromVariant.layers),
                    topology: cloneTopology(fromVariant.topology),
                  },
                },
              },
            },
          },
        };
      });
    },

    setCurrentIcon(id) {
      editorStoreApi.setState((s) => {
        const icon = s.project?.icons[id];
        if (!icon) return s;
        // Idempotency: re-selecting the already-current icon should be a
        // no-op. Returning a new state here would reset viewport/selection
        // and cause a perceived "zoom jump" when a user clicks the same
        // icon twice in the list.
        if (s.currentIconId === id) return s;
        const nextVariantId = Object.keys(icon.variants)[0] ?? null;
        const nextVariant = nextVariantId ? icon.variants[nextVariantId]! : null;
        // Types are universal across icons — carry the active type through
        // switching icons as long as the IconSet catalog still has it.
        const preservedTypeId =
          s.currentTypeId && s.project?.types?.[s.currentTypeId] ? s.currentTypeId : null;
        return {
          currentIconId: id,
          currentVariantId: nextVariantId,
          currentTypeId:
            preservedTypeId ?? (nextVariant ? getVariantDefaultTypeId(nextVariant) : null),
          renderingMode: getResolvedRenderingMode(nextVariant),
          selectedIconGuideIndex: null,
          selection: { layerIds: [], pointIds: [] },
          activeSnapGuides: [],
          pointMarquee: null,
          transitionPreview: null,
          // Lifecycle safety: guide editing is scoped to the active icon +
          // variant size, so drop it on an icon switch.
          editScope: { kind: 'icon' },
        };
      });
    },

    setCurrentVariant(id) {
      editorStoreApi.setState((s) => {
        const icon = s.currentIconId ? s.project?.icons[s.currentIconId] : null;
        const variant = icon?.variants[id];
        if (!variant) return s;

        const preservedTypeId =
          s.currentTypeId && s.project?.types?.[s.currentTypeId] ? s.currentTypeId : null;
        return {
          currentVariantId: id,
          currentTypeId: preservedTypeId ?? getVariantDefaultTypeId(variant),
          renderingMode: getResolvedRenderingMode(variant),
          activeSnapGuides: [],
          pointMarquee: null,
          selectedIconGuideIndex: null,
          selection: { layerIds: [], pointIds: [] },
          transitionPreview: null,
          // Variant switch usually means a different target size → different
          // guide master. Exit guide editing to avoid editing the wrong master.
          editScope: { kind: 'icon' },
        };
      });
    },

    setCurrentType(id) {
      editorStoreApi.setState({ currentTypeId: id });
    },

    addType(typeId) {
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        if (s.project.types?.[typeId]) return s; // already in catalog

        const nextIcons = Object.fromEntries(
          Object.entries(s.project.icons).map(([iconId, icon]) => {
            const nextVariants = Object.fromEntries(
              Object.entries(icon.variants).map(([variantId, variant]) => {
                if (variant.types?.[typeId]) {
                  return [variantId, variant];
                }
                return [variantId, cloneVariantDefaultAsType(variant, typeId)];
              }),
            );
            return [iconId, { ...icon, variants: nextVariants }];
          }),
        );

        return {
          project: {
            ...s.project,
            types: { ...(s.project.types ?? {}), [typeId]: { id: typeId } },
            icons: nextIcons,
          },
          currentTypeId: typeId,
        };
      });
    },

    removeType(typeId) {
      editorStoreApi.setState((s) => {
        if (!s.project || !s.project.types?.[typeId]) return s;

        const { [typeId]: _removed, ...remainingCatalog } = s.project.types;
        const remainingIds = Object.keys(remainingCatalog);
        const fallbackTypeId = remainingIds[0] ?? null;

        const nextIcons = Object.fromEntries(
          Object.entries(s.project.icons).map(([iconId, icon]) => {
            const nextVariants = Object.fromEntries(
              Object.entries(icon.variants).map(([variantId, variant]) => {
                if (!variant.types?.[typeId]) return [variantId, variant];
                const { [typeId]: _v, ...remainingTypes } = variant.types;
                return [
                  variantId,
                  normalizeVariant({
                    ...variant,
                    types: Object.keys(remainingTypes).length > 0 ? remainingTypes : undefined,
                    defaultType:
                      variant.defaultType === typeId
                        ? (fallbackTypeId ?? undefined)
                        : variant.defaultType,
                  }),
                ];
              }),
            );
            return [iconId, { ...icon, variants: nextVariants }];
          }),
        );

        return {
          project: {
            ...s.project,
            types: remainingIds.length > 0 ? remainingCatalog : undefined,
            icons: nextIcons,
          },
          currentTypeId:
            s.currentTypeId === typeId ? (fallbackTypeId ?? s.currentTypeId) : s.currentTypeId,
        };
      });
    },

    renameType(oldTypeId, newTypeId) {
      editorStoreApi.setState((s) => {
        if (!s.project || !s.project.types?.[oldTypeId]) return s;
        if (s.project.types[newTypeId]) return s; // target name already exists

        const { [oldTypeId]: oldDef, ...restCatalog } = s.project.types;
        const nextCatalog: Record<string, IconSetTypeDef> = {
          ...restCatalog,
          [newTypeId]: { ...oldDef, id: newTypeId },
        };

        const nextIcons = Object.fromEntries(
          Object.entries(s.project.icons).map(([iconId, icon]) => {
            const nextVariants = Object.fromEntries(
              Object.entries(icon.variants).map(([variantId, variant]) => {
                if (!variant.types?.[oldTypeId]) return [variantId, variant];
                const oldType = variant.types[oldTypeId];
                const { [oldTypeId]: _v, ...restTypes } = variant.types;
                return [
                  variantId,
                  normalizeVariant({
                    ...variant,
                    types: { ...restTypes, [newTypeId]: { ...oldType, id: newTypeId } },
                    defaultType:
                      variant.defaultType === oldTypeId ? newTypeId : variant.defaultType,
                  }),
                ];
              }),
            );
            return [iconId, { ...icon, variants: nextVariants }];
          }),
        );

        return {
          project: {
            ...s.project,
            types: nextCatalog,
            icons: nextIcons,
          },
          currentTypeId: s.currentTypeId === oldTypeId ? newTypeId : s.currentTypeId,
        };
      });
    },

    setTypeName(typeId, name) {
      editorStoreApi.setState((s) => {
        if (!s.project || !s.project.types?.[typeId]) return s;
        const trimmed = name.trim();
        const existing = s.project.types[typeId];
        const nextName = trimmed.length > 0 ? trimmed : undefined;
        if (existing.name === nextName) return s;
        return {
          project: {
            ...s.project,
            types: {
              ...s.project.types,
              [typeId]: {
                ...existing,
                name: nextName,
              },
            },
          },
        };
      });
    },

    duplicateType(sourceTypeId, newTypeId) {
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        if (s.project.types?.[newTypeId]) return s; // target already exists

        const nextIcons = Object.fromEntries(
          Object.entries(s.project.icons).map(([iconId, icon]) => {
            const nextVariants = Object.fromEntries(
              Object.entries(icon.variants).map(([variantId, variant]) => {
                if (variant.types?.[newTypeId]) return [variantId, variant];
                const sourceType =
                  variant.types?.[sourceTypeId] ??
                  ({
                    id: sourceTypeId,
                    layers: variant.layers,
                    topology: variant.topology,
                  } as IconType);
                const duplicated: IconType = {
                  id: newTypeId,
                  layers: structuredClone(sourceType.layers),
                  topology: sourceType.topology ? structuredClone(sourceType.topology) : undefined,
                };
                return [
                  variantId,
                  normalizeVariant({
                    ...variant,
                    types: { ...(variant.types ?? {}), [newTypeId]: duplicated },
                  }),
                ];
              }),
            );
            return [iconId, { ...icon, variants: nextVariants }];
          }),
        );

        return {
          project: {
            ...s.project,
            types: { ...(s.project.types ?? {}), [newTypeId]: { id: newTypeId } },
            icons: nextIcons,
          },
          currentTypeId: newTypeId,
        };
      });
    },

    setTopology(iconId, variantId, topology) {
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        const icon = s.project.icons[iconId];
        const variant = icon?.variants[variantId];
        if (!icon || !variant) return s;

        return {
          project: {
            ...s.project,
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...icon,
                variants: {
                  ...icon.variants,
                  [variantId]: {
                    ...variant,
                    topology,
                  },
                },
              },
            },
          },
        };
      });
    },

    setStateTopology(iconId, typeId, topology) {
      editorStoreApi.setState((s) => {
        if (!s.project || !s.currentVariantId) return s;
        const icon = s.project.icons[iconId];
        const variant = icon?.variants[s.currentVariantId];
        if (!icon || !variant) return s;

        return {
          project: {
            ...s.project,
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...icon,
                variants: {
                  ...icon.variants,
                  [s.currentVariantId]: normalizeVariant({
                    ...variant,
                    topology,
                    types: variant.types
                      ? {
                          ...variant.types,
                          [typeId]: {
                            ...(variant.types[typeId] ?? {
                              id: typeId,
                              layers: variant.layers,
                            }),
                            topology,
                          },
                        }
                      : variant.types,
                  }),
                },
              },
            },
          },
        };
      });
    },

    setSelectedIconGuideIndex(index) {
      editorStoreApi.setState({
        selectedIconGuideIndex: index,
        selection: { layerIds: [], pointIds: [], guideIndexes: index === null ? [] : [index] },
      });
    },

    patchLayer(iconId: string, layerId: string, patch: Partial<Layer>) {
      // `iconId` is ignored in guide scope — the master's layers are the
      // target. In icon scope we only honour writes when `iconId` matches
      // the active icon (matches the pre-editScope behaviour since callers
      // always passed `s.currentIconId`).
      editorStoreApi.setState((s) => {
        if (!patch) return s;
        if (s.editScope.kind === 'icon' && iconId !== s.currentIconId) return s;

        const currentLayers = readCurrentLayers(s);
        if (!currentLayers) return s;
        const layer = currentLayers[layerId];
        if (!layer) return s;

        const nextLayer = { ...layer, ...patch };
        // Invariant: `path.d` is canonical. When `path` is patched without an
        // explicit new primitive, the primitive metadata is stale and must be
        // cleared. We stash the kind on `formerPrimitiveKind` as a breadcrumb
        // so the Inspector can explain why polygon/star controls are no
        // longer available. Shape-tool drags and `setLayerPrimitive` supply
        // `primitive` in the same patch to preserve it.
        if (patch.path && !('primitive' in patch) && layer.primitive) {
          nextLayer.formerPrimitiveKind = layer.primitive.kind;
          delete nextLayer.primitive;
        }
        // Invariant (W2-1): the same rule for `compound` — `path.d` is
        // the cached evaluation of `compound.tree`, so any direct `path`
        // mutation outside the compound flow (i.e., the patch doesn't
        // also carry a fresh `compound`) makes the cached evaluation
        // stale. Clear `compound` and stamp `formerCompound` so the
        // Inspector can explain why the operand tree disappeared.
        // `applyBoolean` and `flattenCompound` supply `compound` in the
        // same patch to preserve / drop it explicitly.
        if (patch.path && !('compound' in patch) && layer.compound) {
          nextLayer.formerCompound = true;
          delete nextLayer.compound;
        }

        const patchState = writeCurrentLayers(s, (prev) => {
          const nextLayers = { ...prev, [layerId]: nextLayer };
          // Topology-lock check only applies in icon scope (masters don't
          // carry topology). Throw the same error shape as before.
          if (s.editScope.kind === 'icon' && patch.path) {
            const variant = s.project?.icons[s.currentIconId!]?.variants[s.currentVariantId!];
            if (variant?.topology?.locked) {
              const nextTopology = computeTopology({
                layers: nextLayers,
                topology: variant.topology,
              });
              const compatibility = areTopologiesCompatible(variant.topology, nextTopology);
              if (!compatibility.compatible) {
                throw new Error(`Topology is locked: ${compatibility.mismatches.join(' ')}`);
              }
            }
          }
          return nextLayers;
        });
        return patchState ?? s;
      });
    },

    renameLayer(iconId, oldLayerId, newLayerId) {
      editorStoreApi.setState((s) => {
        if (oldLayerId === newLayerId) return s;
        if (s.editScope.kind === 'guideMaster') {
          // Masters don't carry components or topology, so the rename is a
          // flat key swap on `master.layers` + selection update.
          const layers = readCurrentLayers(s);
          if (!layers || !layers[oldLayerId] || layers[newLayerId]) return s;
          const patch = writeCurrentLayers(s, (prev) => {
            const nextLayers: Record<string, Layer> = {};
            for (const [key, l] of Object.entries(prev)) {
              if (key === oldLayerId) {
                nextLayers[newLayerId] = { ...l, id: newLayerId };
              } else {
                nextLayers[key] =
                  l.clipPathLayerId === oldLayerId
                    ? { ...l, clipPathLayerId: newLayerId }
                    : l;
              }
            }
            return nextLayers;
          });
          if (!patch) return s;
          return {
            ...patch,
            selection: s.selection.layerIds.includes(oldLayerId)
              ? {
                  ...s.selection,
                  layerIds: s.selection.layerIds.map((id) =>
                    id === oldLayerId ? newLayerId : id,
                  ),
                }
              : s.selection,
          };
        }

        if (!s.project || !s.currentVariantId) return s;
        const icon = s.project.icons[iconId];
        const variant = icon?.variants[s.currentVariantId];
        const layer = variant?.layers[oldLayerId];
        if (!icon || !variant || !layer) return s;
        if (variant.layers[newLayerId]) return s;

        // Rebuild layers Record preserving insertion order
        const nextLayers: Record<string, Layer> = {};
        for (const [key, l] of Object.entries(variant.layers)) {
          if (key === oldLayerId) {
            // Replace old key with new key, update layer.id
            nextLayers[newLayerId] = { ...l, id: newLayerId };
          } else {
            // Update clipPathLayerId references in other layers
            const updatedLayer =
              l.clipPathLayerId === oldLayerId
                ? { ...l, clipPathLayerId: newLayerId }
                : l;
            nextLayers[key] = updatedLayer;
          }
        }

        // Update selection if the renamed layer is selected
        const nextSelection = s.selection.layerIds.includes(oldLayerId)
          ? {
              ...s.selection,
              layerIds: s.selection.layerIds.map((id) =>
                id === oldLayerId ? newLayerId : id,
              ),
            }
          : s.selection;

        // Update components that reference the old layer ID
        let nextComponents = icon.components;
        if (nextComponents) {
          const updatedComponents: Record<string, typeof nextComponents[string]> = {};
          let changed = false;
          for (const [compId, comp] of Object.entries(nextComponents)) {
            if (comp.layerIds.includes(oldLayerId)) {
              changed = true;
              updatedComponents[compId] = {
                ...comp,
                layerIds: comp.layerIds.map((id) =>
                  id === oldLayerId ? newLayerId : id,
                ),
              };
            } else {
              updatedComponents[compId] = comp;
            }
          }
          if (changed) nextComponents = updatedComponents;
        }

        // Update topology layerPairs if present
        const nextTopology = variant.topology
          ? {
              ...variant.topology,
              layerPairs: variant.topology.layerPairs.map((pair) =>
                pair.layerId === oldLayerId
                  ? { ...pair, layerId: newLayerId }
                  : pair,
              ),
            }
          : variant.topology;

        return {
          selection: nextSelection,
          project: {
            ...s.project,
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...replaceVariantLayers(icon, s.currentVariantId, nextLayers, nextTopology),
                components: nextComponents,
              },
            },
          },
        };
      });
    },

    setLayerVisibility(iconId, layerId, visible) {
      editorStoreApi.setState((s) => {
        if (s.editScope.kind === 'icon' && iconId !== s.currentIconId) return s;
        const layers = readCurrentLayers(s);
        const layer = layers?.[layerId];
        if (!layers || !layer) return s;
        return (
          writeCurrentLayers(s, (prev) => ({ ...prev, [layerId]: { ...layer, visible } })) ?? s
        );
      });
    },

    setClipMask(clipLayerId, targetLayerIds) {
      editorStoreApi.setState((s) => {
        if (!s.project || !s.currentIconId || !s.currentVariantId) return s;
        const icon = s.project.icons[s.currentIconId];
        const variant = icon?.variants[s.currentVariantId];
        const maskLayer = variant?.layers[clipLayerId];
        if (!icon || !variant || !maskLayer) return s;

        const nextTargetIds = Array.from(new Set(targetLayerIds)).filter(
          (layerId) => layerId !== clipLayerId && Boolean(variant.layers[layerId]),
        );
        if (nextTargetIds.length === 0) return s;

        const previousMaskIds = new Set<string>();
        for (const targetLayerId of nextTargetIds) {
          const existingMaskId = variant.layers[targetLayerId]?.clipPathLayerId;
          if (existingMaskId && existingMaskId !== clipLayerId) {
            previousMaskIds.add(existingMaskId);
          }
        }

        const nextLayers = { ...variant.layers };
        nextLayers[clipLayerId] = {
          ...maskLayer,
          isClipMask: true,
          clipPathLayerId: undefined,
        };

        for (const targetLayerId of nextTargetIds) {
          const targetLayer = nextLayers[targetLayerId];
          if (!targetLayer) continue;
          nextLayers[targetLayerId] = {
            ...targetLayer,
            clipPathLayerId: clipLayerId,
          };
        }

        for (const previousMaskId of previousMaskIds) {
          const previousMaskLayer = nextLayers[previousMaskId];
          if (!previousMaskLayer) continue;
          if (!hasClipMaskTargets(nextLayers, previousMaskId)) {
            nextLayers[previousMaskId] = {
              ...previousMaskLayer,
              isClipMask: false,
            };
          }
        }

        return {
          project: {
            ...s.project,
            icons: {
              ...s.project.icons,
              [icon.id]: replaceVariantLayers(icon, s.currentVariantId, nextLayers),
            },
          },
        };
      });
    },

    releaseClipMask(layerId) {
      editorStoreApi.setState((s) => {
        if (!s.project || !s.currentIconId || !s.currentVariantId) return s;
        const icon = s.project.icons[s.currentIconId];
        const variant = icon?.variants[s.currentVariantId];
        const layer = variant?.layers[layerId];
        if (!icon || !variant || !layer) return s;

        const nextLayers = { ...variant.layers };

        if (layer.isClipMask) {
          nextLayers[layerId] = {
            ...layer,
            isClipMask: false,
          };

          for (const candidateId of Object.keys(nextLayers)) {
            const candidate = nextLayers[candidateId];
            if (candidate?.clipPathLayerId === layerId) {
              nextLayers[candidateId] = {
                ...candidate,
                clipPathLayerId: undefined,
              };
            }
          }
        } else if (layer.clipPathLayerId) {
          const maskLayerId = layer.clipPathLayerId;
          nextLayers[layerId] = {
            ...layer,
            clipPathLayerId: undefined,
          };

          const maskLayer = nextLayers[maskLayerId];
          if (maskLayer && !hasClipMaskTargets(nextLayers, maskLayerId)) {
            nextLayers[maskLayerId] = {
              ...maskLayer,
              isClipMask: false,
            };
          }
        } else {
          return s;
        }

        return {
          project: {
            ...s.project,
            icons: {
              ...s.project.icons,
              [icon.id]: replaceVariantLayers(icon, s.currentVariantId, nextLayers),
            },
          },
        };
      });
    },

    setSelection(selection) {
      const nextSelection = normalizeSelection(selection);
      editorStoreApi.setState({
        selection: nextSelection,
        selectedIconGuideIndex: nextSelection.guideIndexes[0] ?? null,
      });
    },

    clearSelection() {
      editorStoreApi.setState({
        selection: { layerIds: [], pointIds: [], guideIndexes: [] },
        selectedIconGuideIndex: null,
        activeSnapGuides: [],
        pointMarquee: null,
        pendingPenHandle: null,
      });
    },

    setActiveSnapGuides(guides) {
      editorStoreApi.setState({ activeSnapGuides: guides });
    },

    toggleSnap() {
      editorStoreApi.setState((s) => ({
        snapEnabled: !s.snapEnabled,
        activeSnapGuides: s.snapEnabled ? [] : s.activeSnapGuides,
      }));
    },

    toggleGuidesVisible() {
      editorStoreApi.setState((s) => ({
        guidesVisible: !s.guidesVisible,
      }));
    },

    setGuideStyle(style) {
      editorStoreApi.setState({ guideStyle: style });
    },

    setViewport(viewport) {
      editorStoreApi.setState((s) => ({ viewport: { ...s.viewport, ...viewport } }));
    },

    setTool(tool) {
      editorStoreApi.setState({
        tool,
        selection: { layerIds: [], pointIds: [] },
        selectedIconGuideIndex: null,
        activeSnapGuides: [],
        pointMarquee: null,
        pendingPenHandle: null,
      });
    },

    setShapeSubTool(shapeSubTool) {
      editorStoreApi.setState({ shapeSubTool });
    },

    setShapePolygonSides(sides) {
      editorStoreApi.setState({ shapePolygonSides: clampInteger(sides, 3) });
    },

    setShapeStarPoints(points) {
      editorStoreApi.setState({ shapeStarPoints: clampInteger(points, 2) });
    },

    enterGuideEditingMode(masterId) {
      editorStoreApi.setState((s) => {
        if (!s.project?.guideMasters?.[masterId]) return s;
        // Guides stay as semantic `items` (rect / hline / vline / ellipse /
        // drawPoint). They're rendered by the overlay canvas
        // (lib/editor-overlay-canvas) as thin dashed strokes — never as
        // icon paths — so visual fidelity is preserved at any zoom and
        // strokes don't scale with the viewBox. Editing happens in the
        // GuideMasterPanel with item-shape-specific numeric fields.
        //
        // Earlier flow migrated items into Layer objects so the path
        // editor and Inspector could mutate them, but that routed guide
        // shapes through the icon-layer renderer (heavy strokes, thick
        // black blocks at zoom) and through Inspector helpers that
        // silently no-op'd in guide-master scope. The migration helper
        // (`migrateMasterItemsToLayers`) is retained for legacy data but
        // is no longer invoked on enter.
        return {
          editScope: { kind: 'guideMaster', masterId },
          snapEnabled: true,
          // Drop layer/point selection so the canvas clearly reflects
          // "editing guides, not the icon".
          selection: { layerIds: [], pointIds: [], guideIndexes: [] },
        };
      });
    },

    exitGuideEditingMode() {
      editorStoreApi.setState({
        editScope: { kind: 'icon' },
        selection: { layerIds: [], pointIds: [] },
      });
    },

    addLayer(layer) {
      editorStoreApi.setState((s) => {
        const layers = readCurrentLayers(s);
        if (!layers) return s;
        if (layers[layer.id]) return s;
        return (
          writeCurrentLayers(s, (prev) => ({ ...prev, [layer.id]: layer })) ?? s
        );
      });
    },

    setLayerPrimitive(iconId, layerId, next) {
      const nextPath = buildPrimitivePath(next);
      editorStoreApi.setState((s) => {
        if (s.editScope.kind === 'icon' && iconId !== s.currentIconId) return s;
        const currentLayers = readCurrentLayers(s);
        if (!currentLayers) return s;
        const layer = currentLayers[layerId];
        if (!layer) return s;

        // Re-parameterising clears the "former primitive" breadcrumb, since
        // the layer now has a live primitive again.
        const { formerPrimitiveKind: _unused, ...layerWithoutBreadcrumb } = layer;
        const nextLayer: Layer = {
          ...layerWithoutBreadcrumb,
          path: { ...(layer.path ?? {}), d: nextPath },
          primitive: next,
        };

        const patchState = writeCurrentLayers(s, (prev) => {
          const nextLayers = { ...prev, [layerId]: nextLayer };
          if (s.editScope.kind === 'icon') {
            const variant = s.project?.icons[s.currentIconId!]?.variants[s.currentVariantId!];
            if (variant?.topology?.locked) {
              const nextTopology = computeTopology({
                layers: nextLayers,
                topology: variant.topology,
              });
              const compatibility = areTopologiesCompatible(variant.topology, nextTopology);
              if (!compatibility.compatible) {
                throw new Error(`Topology is locked: ${compatibility.mismatches.join(' ')}`);
              }
            }
          }
          return nextLayers;
        });
        return patchState ?? s;
      });
    },

    setPointMarquee(marquee) {
      editorStoreApi.setState({ pointMarquee: marquee });
    },

    setPointTransformLabel(label) {
      editorStoreApi.setState({ pointTransformLabel: label });
    },

    setPendingPenHandle(handle) {
      editorStoreApi.setState({ pendingPenHandle: handle });
    },

    setTransitionPreview(preview) {
      editorStoreApi.setState({ transitionPreview: preview });
    },

    updateTransitionPreview(progress) {
      const s = editorStoreApi.getState();
      const preview = s.transitionPreview;
      if (!preview || !s.project) return;

      const clampedProgress = Math.max(0, Math.min(1, progress));

      // If the resolved transition hasn't changed, we can skip re-resolving
      // and just recompute interpolated values.
      editorStoreApi.setState({
        transitionPreview: {
          ...preview,
          progress: clampedProgress,
          interpolatedValues: interpolateTransitionValues(
            preview.resolvedTransition,
            clampedProgress,
          ),
        },
      });
    },

    stopTransitionPreview() {
      editorStoreApi.setState({ transitionPreview: null });
    },

    setSelectedTransitionId(transitionId) {
      editorStoreApi.setState({ selectedTransitionId: transitionId });
    },

    updateProjectMeta(patch) {
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, ...patch },
          },
        };
      });
    },

    addGuideMaster(master) {
      editorStoreApi.setState((s) => {
        if (!s.project) return s;

        const nextId = ensureUniqueRecordId(master.id, Object.keys(s.project.guideMasters ?? {}));
        const nextMaster =
          nextId === master.id
            ? master
            : {
                ...master,
                id: nextId,
              };

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            guideMasters: {
              [nextMaster.id]: nextMaster,
              ...(s.project.guideMasters ?? {}),
            },
          },
        };
      });
    },

    updateGuideMaster(id, patch) {
      editorStoreApi.setState((s) => {
        if (!s.project?.guideMasters?.[id]) return s;
        const { id: _nextId, ...safePatch } = patch;

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            guideMasters: {
              ...s.project.guideMasters,
              [id]: {
                ...s.project.guideMasters[id],
                ...safePatch,
              },
            },
          },
        };
      });
    },

    removeGuideMaster(id) {
      editorStoreApi.setState((s) => {
        if (!s.project?.guideMasters?.[id]) return s;

        const nextGuideMasters = { ...s.project.guideMasters };
        delete nextGuideMasters[id];

        // Lifecycle safety: if the deleted master was the one being edited on
        // canvas, snap the scope back to icon and drop the master-scoped
        // selection — those layer IDs no longer exist, and carrying them
        // across the scope flip risks targeting unrelated icon layers if
        // IDs collide.
        const wasEditingDeletedMaster =
          s.editScope.kind === 'guideMaster' && s.editScope.masterId === id;
        const nextEditScope: EditScope = wasEditingDeletedMaster
          ? { kind: 'icon' }
          : s.editScope;

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            guideMasters: Object.keys(nextGuideMasters).length > 0 ? nextGuideMasters : undefined,
          },
          editScope: nextEditScope,
          ...(wasEditingDeletedMaster
            ? { selection: { layerIds: [], pointIds: [] } }
            : null),
        };
      });
    },

    addGuideItem(masterId, item) {
      editorStoreApi.setState((s) => {
        const guideMaster = s.project?.guideMasters?.[masterId];
        if (!s.project || !guideMaster) return s;
        const nextItems = [...guideMaster.items, item];
        const nextIndex = nextItems.length - 1;

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            guideMasters: {
              ...s.project.guideMasters,
              [masterId]: {
                ...guideMaster,
                items: nextItems,
              },
            },
          },
          selectedIconGuideIndex: nextIndex,
          selection: { layerIds: [], pointIds: [], guideIndexes: [nextIndex] },
        };
      });
    },

    updateGuideItem(masterId, index, item) {
      editorStoreApi.setState((s) => {
        const guideMaster = s.project?.guideMasters?.[masterId];
        if (!s.project || !guideMaster || index < 0 || index >= guideMaster.items.length) return s;

        const nextItems = guideMaster.items.map((entry, entryIndex) =>
          entryIndex === index ? item : entry,
        );

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            guideMasters: {
              ...s.project.guideMasters,
              [masterId]: {
                ...guideMaster,
                items: nextItems,
              },
            },
          },
        };
      });
    },

    removeGuideItem(masterId, index) {
      editorStoreApi.setState((s) => {
        const guideMaster = s.project?.guideMasters?.[masterId];
        if (!s.project || !guideMaster || index < 0 || index >= guideMaster.items.length) return s;
        const nextItems = guideMaster.items.filter((_, entryIndex) => entryIndex !== index);
        const nextSelectedIndex =
          s.selectedIconGuideIndex === null
            ? null
            : s.selectedIconGuideIndex === index
              ? null
              : s.selectedIconGuideIndex > index
                ? s.selectedIconGuideIndex - 1
                : s.selectedIconGuideIndex;

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            guideMasters: {
              ...s.project.guideMasters,
              [masterId]: {
                ...guideMaster,
                items: nextItems,
              },
            },
          },
          selectedIconGuideIndex: nextSelectedIndex,
          selection: {
            layerIds: [],
            pointIds: [],
            guideIndexes: nextSelectedIndex === null ? [] : [nextSelectedIndex],
          },
        };
      });
    },

    addIconGuide(iconId, item) {
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        const icon = s.project.icons[iconId];
        if (!icon) return s;
        const nextGuides = [...(icon.customGuides ?? []), item];

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...icon,
                customGuides: nextGuides,
              },
            },
          },
          selectedIconGuideIndex: nextGuides.length - 1,
        };
      });
    },

    updateIconGuide(iconId, index, item) {
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        const icon = s.project.icons[iconId];
        if (!icon?.customGuides || index < 0 || index >= icon.customGuides.length) return s;

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...icon,
                customGuides: icon.customGuides.map((entry, entryIndex) =>
                  entryIndex === index ? item : entry,
                ),
              },
            },
          },
        };
      });
    },

    removeIconGuide(iconId, index) {
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        const icon = s.project.icons[iconId];
        if (!icon?.customGuides || index < 0 || index >= icon.customGuides.length) return s;

        const nextGuides = icon.customGuides.filter((_, entryIndex) => entryIndex !== index);
        const nextSelectedIndex =
          s.selectedIconGuideIndex === null
            ? null
            : s.selectedIconGuideIndex === index
              ? null
              : s.selectedIconGuideIndex > index
                ? s.selectedIconGuideIndex - 1
                : s.selectedIconGuideIndex;

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...icon,
                customGuides: nextGuides.length > 0 ? nextGuides : undefined,
              },
            },
          },
          selectedIconGuideIndex: nextSelectedIndex,
        };
      });
    },

    removeSelectedGuides(iconId, indexes) {
      editorStoreApi.setState((s) => {
        if (!s.project || indexes.length === 0) return s;
        const icon = s.project.icons[iconId];
        if (!icon?.customGuides?.length) return s;

        const toRemove = new Set(
          indexes.filter((index) => index >= 0 && index < icon.customGuides!.length),
        );
        if (toRemove.size === 0) return s;

        const nextGuides = icon.customGuides.filter((_, entryIndex) => !toRemove.has(entryIndex));
        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...icon,
                customGuides: nextGuides.length > 0 ? nextGuides : undefined,
              },
            },
          },
          selection: {
            ...s.selection,
            guideIndexes: [],
          },
          selectedIconGuideIndex: null,
        };
      });
    },

    addCollection(collection) {
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        const existing = s.project.collections ?? {};
        const collectionId = ensureUniqueRecordId(collection.id, Object.keys(existing));
        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            collections: {
              ...existing,
              [collectionId]: {
                ...collection,
                id: collectionId,
                iconIds: Array.from(new Set(collection.iconIds)),
              },
            },
          },
        };
      });
    },

    removeCollection(collectionId) {
      editorStoreApi.setState((s) => {
        if (!s.project?.collections?.[collectionId]) return s;
        const next = { ...s.project.collections };
        delete next[collectionId];
        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            collections: next,
          },
        };
      });
    },

    renameCollection(collectionId, name) {
      editorStoreApi.setState((s) => {
        const collection = s.project?.collections?.[collectionId];
        if (!s.project || !collection) return s;
        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            collections: {
              ...(s.project.collections ?? {}),
              [collectionId]: { ...collection, name },
            },
          },
        };
      });
    },

    addIconToCollection(collectionId, iconId) {
      editorStoreApi.setState((s) => {
        const collection = s.project?.collections?.[collectionId];
        if (!s.project || !collection || !s.project.icons[iconId]) return s;
        if (collection.iconIds.includes(iconId)) return s;
        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            collections: {
              ...(s.project.collections ?? {}),
              [collectionId]: { ...collection, iconIds: [...collection.iconIds, iconId] },
            },
          },
        };
      });
    },

    removeIconFromCollection(collectionId, iconId) {
      editorStoreApi.setState((s) => {
        const collection = s.project?.collections?.[collectionId];
        if (!s.project || !collection) return s;
        const nextIds = collection.iconIds.filter((id) => id !== iconId);
        if (nextIds.length === collection.iconIds.length) return s;
        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            collections: {
              ...(s.project.collections ?? {}),
              [collectionId]: { ...collection, iconIds: nextIds },
            },
          },
        };
      });
    },

    toggleFavorite(iconId) {
      editorStoreApi.setState((s) => ({
        favorites: s.favorites.includes(iconId)
          ? s.favorites.filter((id) => id !== iconId)
          : [...s.favorites, iconId],
      }));
    },

    addIconSet(name) {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const iconSetId = ensureUniqueRecordId(
        toKebabCase(trimmed) || 'icon-set',
        Object.keys(editorStoreApi.getState().workspace?.iconSets ?? {}),
      );
      const now = new Date().toISOString();
      editorStoreApi.setState((s) => {
        const workspace = s.workspace ?? {
          version: '2.0',
          meta: { name: 'Untitled Workspace', createdAt: now, updatedAt: now },
          iconSets: {},
          activeIconSetId: undefined,
        };

        return buildWorkspaceState(
          {
            ...workspace,
            meta: { ...workspace.meta, updatedAt: now },
            iconSets: {
              ...workspace.iconSets,
              [iconSetId]: createEmptyIconSet(trimmed, now),
            },
            activeIconSetId: iconSetId,
          },
          iconSetId,
          { previousState: s },
        );
      });
      return iconSetId;
    },

    removeIconSet(iconSetId) {
      editorStoreApi.setState((s) => {
        if (!s.workspace?.iconSets[iconSetId]) return s;
        const nextIconSets = { ...s.workspace.iconSets };
        delete nextIconSets[iconSetId];
        const nextWorkspace: Workspace = {
          ...s.workspace,
          iconSets: nextIconSets,
        };
        const nextActiveIconSetId =
          s.activeIconSetId === iconSetId ? getFirstIconSetId(nextWorkspace) : s.activeIconSetId;
        const nextTabs = s.openTabs.filter((tab) => tab.iconSetId !== iconSetId);
        const nextActiveTabId =
          s.activeTabId && nextTabs.some((tab) => tab.id === s.activeTabId)
            ? s.activeTabId
            : (nextTabs[0]?.id ?? null);
        if (!nextActiveIconSetId) {
          return {
            workspace: nextWorkspace,
            project: null,
            activeIconSetId: null,
            currentIconId: null,
            currentVariantId: null,
            openTabs: nextTabs,
            activeTabId: nextActiveTabId,
          };
        }
        return {
          ...buildWorkspaceState(nextWorkspace, nextActiveIconSetId, {
            previousState: s,
            keepTabs: true,
          }),
          openTabs: nextTabs,
          activeTabId: nextActiveTabId,
        };
      });
    },

    renameIconSet(iconSetId, name) {
      const trimmed = name.trim();
      if (!trimmed) return;
      editorStoreApi.setState((s) => {
        const iconSet = s.workspace?.iconSets[iconSetId];
        if (!s.workspace || !iconSet) return s;
        const nextIconSet: IconSet = {
          ...iconSet,
          meta: { ...iconSet.meta, name: trimmed, updatedAt: new Date().toISOString() },
        };
        return {
          workspace: replaceWorkspaceIconSet(s.workspace, iconSetId, nextIconSet),
          project: s.activeIconSetId === iconSetId ? nextIconSet : s.project,
        };
      });
    },

    setActiveIconSet(iconSetId) {
      editorStoreApi.setState((s) => {
        if (!s.workspace?.iconSets[iconSetId]) return s;
        // Filter tabs to only keep those belonging to the new icon set
        const validTabs = (s.openTabs ?? []).filter((tab) => tab.id.startsWith(`${iconSetId}::`));
        const activeTab = s.activeTabId && validTabs.some((t) => t.id === s.activeTabId) ? s.activeTabId : null;
        return {
          ...buildWorkspaceState(s.workspace, iconSetId, { previousState: s, keepTabs: true }),
          openTabs: validTabs,
          activeTabId: activeTab,
          // Clear multi-select when switching icon sets to prevent cross-set selection leaks
          selectedIconIds: [],
        };
      });
    },

    addSyncTarget(target) {
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            syncTargets: [...(s.project.syncTargets ?? []), target],
          },
        };
      });
    },

    updateSyncTarget(targetId, patch) {
      editorStoreApi.setState((s) => {
        if (!s.project?.syncTargets?.some((target) => target.id === targetId)) return s;
        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            syncTargets: (s.project.syncTargets ?? []).map((target) =>
              target.id === targetId ? { ...target, ...patch } : target,
            ),
          },
        };
      });
    },

    removeSyncTarget(targetId) {
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        const nextTargets = (s.project.syncTargets ?? []).filter((target) => target.id !== targetId);
        if (nextTargets.length === (s.project.syncTargets ?? []).length) return s;
        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            syncTargets: nextTargets,
          },
          pendingPublishes: s.pendingPublishes.filter((pending) => pending.targetId !== targetId),
        };
      });
    },

    schedulePendingPublish(targetId, semver) {
      editorStoreApi.setState((s) => ({
        pendingPublishes: [
          ...s.pendingPublishes.filter((pending) => pending.targetId !== targetId),
          {
            targetId,
            scheduledAt: Date.now(),
            semver,
          },
        ],
      }));
    },

    cancelPendingPublish(targetId) {
      editorStoreApi.setState((s) => ({
        pendingPublishes: s.pendingPublishes.filter((pending) => pending.targetId !== targetId),
      }));
    },

    clearAutoPublishSkip() {
      editorStoreApi.setState({ skipNextAutoPublish: false });
    },

    openIconTab(iconSetId, iconId, options) {
      const state = editorStoreApi.getState();
      const workspace = state.workspace;
      const iconSet = workspace?.iconSets[iconSetId];
      if (!iconSet?.icons[iconId]) return null;
      const variantId = getFirstVariantId(iconSet, iconId);
      const tabId = createTabId(iconSetId, iconId);
      editorStoreApi.setState((s) => {
        const exists = s.openTabs.some((tab) => tab.id === tabId);
        const nextTabs = exists
          ? s.openTabs
          : [
              ...s.openTabs,
              {
                id: tabId,
                iconSetId,
                iconId,
                variantId,
              },
            ];
        const shouldFocus = options?.focus !== false;
        if (!shouldFocus) {
          return { openTabs: nextTabs };
        }
        // Idempotency guard: if we're already focused on this exact tab,
        // don't rebuild workspace state — that would reset the viewport
        // (zoom/pan), clear selection, etc. Users expect clicking an
        // already-open icon to be a no-op.
        if (
          s.activeTabId === tabId
          && s.activeIconSetId === iconSetId
          && s.currentIconId === iconId
        ) {
          return exists ? s : { openTabs: nextTabs };
        }
        return {
          ...buildWorkspaceState(s.workspace!, iconSetId, {
            previousState: s,
            keepTabs: true,
            requestedIconId: iconId,
          }),
          currentVariantId: variantId,
          openTabs: nextTabs,
          activeTabId: tabId,
        };
      });
      return tabId;
    },

    closeIconTab(tabId) {
      editorStoreApi.setState((s) => {
        const index = s.openTabs.findIndex((tab) => tab.id === tabId);
        if (index === -1) return s;
        const nextTabs = s.openTabs.filter((tab) => tab.id !== tabId);
        if (s.activeTabId !== tabId) {
          return {
            openTabs: nextTabs,
          };
        }

        const fallbackTab = nextTabs[index] ?? nextTabs[index - 1] ?? null;
        if (!fallbackTab) {
          return {
            openTabs: nextTabs,
            activeTabId: null,
          };
        }

        return {
          ...buildWorkspaceState(s.workspace!, fallbackTab.iconSetId, {
            previousState: s,
            keepTabs: true,
            requestedIconId: fallbackTab.iconId,
          }),
          currentVariantId: fallbackTab.variantId,
          openTabs: nextTabs,
          activeTabId: fallbackTab.id,
        };
      });
    },

    setActiveTab(tabId) {
      editorStoreApi.setState((s) => {
        const tab = s.openTabs.find((entry) => entry.id === tabId);
        if (!tab || !s.workspace) return s;
        return {
          ...buildWorkspaceState(s.workspace, tab.iconSetId, {
            previousState: s,
            keepTabs: true,
            requestedIconId: tab.iconId,
          }),
          currentVariantId:
            tab.variantId ?? getFirstVariantId(s.workspace.iconSets[tab.iconSetId], tab.iconId),
          openTabs: s.openTabs,
          activeTabId: tabId,
        };
      });
    },

    generateVariantMatrix(iconId, options) {
      const createdVariantIds: string[] = [];
      editorStoreApi.setState((s) => {
        // Icon-scope only: there is no icon to materialise variants for while
        // the canvas is editing a guide master.
        if (s.editScope.kind !== 'icon') return s;
        if (!s.project) return s;
        const icon = s.project.icons[iconId];
        if (!icon) return s;

        const sizes = options.sizes.filter((size) => Number.isFinite(size) && size > 0);
        const weights = options.weights;
        const scales = options.scales;
        if (sizes.length === 0 || weights.length === 0 || scales.length === 0) return s;

        const existingVariants = { ...icon.variants };
        const existingIds = Object.keys(existingVariants);
        const existingNames = Object.values(existingVariants).map(
          (variant) => variant.name ?? String(variant.size),
        );

        for (const size of sizes) {
          for (const weight of weights) {
            for (const scale of scales) {
              const already = Object.values(existingVariants).find(
                (variant) =>
                  variant.size === size && variant.weight === weight && variant.scale === scale,
              );
              if (already) continue;

              const sourceVariant =
                pickClosestVariant(
                  existingVariants,
                  size,
                  weight,
                  scale,
                  options.sourceVariantId,
                ) ?? Object.values(existingVariants)[0];
              if (!sourceVariant) continue;

              const nextVariantId = buildVariantId(size, [...existingIds, ...createdVariantIds]);
              createdVariantIds.push(nextVariantId);
              const nextLayers = cloneLayers(sourceVariant.layers);
              const nextTopology = cloneTopology(sourceVariant.topology);
              const nextName = buildVariantName(size, existingNames, `${size}-${weight}-${scale}`);
              existingNames.push(nextName);

              existingVariants[nextVariantId] = {
                id: nextVariantId,
                name: nextName,
                size,
                viewBox: scaleViewBoxToSize(sourceVariant.viewBox, size),
                renderingMode: sourceVariant.renderingMode,
                guideMasterId:
                  sourceVariant.guideMasterId ??
                  Object.values(s.project.guideMasters ?? {}).find(
                    (master) => master.targetSize === size,
                  )?.id,
                weight,
                scale,
                layers: nextLayers,
                topology: nextTopology,
              };
            }
          }
        }

        if (createdVariantIds.length === 0) return s;

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...icon,
                variants: existingVariants,
              },
            },
          },
          currentVariantId: createdVariantIds[createdVariantIds.length - 1] ?? s.currentVariantId,
        };
      });
      return createdVariantIds;
    },

    upsertSymbolComponent(iconId, component) {
      editorStoreApi.setState((s) => {
        // Icon-scope only: components live on icons, not on guide masters.
        if (s.editScope.kind !== 'icon') return s;
        if (!s.project) return s;
        const icon = s.project.icons[iconId];
        if (!icon) return s;

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...icon,
                components: {
                  ...(icon.components ?? {}),
                  [component.kind]: {
                    ...component,
                    layerIds: Array.from(new Set(component.layerIds)),
                  },
                },
              },
            },
          },
        };
      });
    },

    removeSymbolComponent(iconId, kind) {
      editorStoreApi.setState((s) => {
        // Icon-scope only: components live on icons, not on guide masters.
        if (s.editScope.kind !== 'icon') return s;
        if (!s.project) return s;
        const icon = s.project.icons[iconId];
        if (!icon?.components?.[kind]) return s;
        const nextComponents = { ...icon.components };
        delete nextComponents[kind];

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...icon,
                components: nextComponents,
              },
            },
          },
        };
      });
    },

    removeSelectedLayers() {
      editorStoreApi.setState((s) => {
        const selectedLayerIds = Array.from(new Set(s.selection.layerIds));
        if (selectedLayerIds.length === 0) return s;
        const layers = readCurrentLayers(s);
        if (!layers) return s;

        const patch = writeCurrentLayers(s, (prev) => {
          const next = { ...prev };
          let removed = false;
          for (const layerId of selectedLayerIds) {
            if (!next[layerId]) continue;
            delete next[layerId];
            removed = true;
          }
          return removed ? next : prev;
        });
        if (!patch) return s;
        return {
          ...patch,
          selection: {
            layerIds: [],
            pointIds: [],
            guideIndexes: s.selection.guideIndexes ?? [],
          },
          activeSnapGuides: [],
          pointMarquee: null,
        };
      });
    },

    copySelectedLayers() {
      const s = editorStoreApi.getState();
      const layers = readCurrentLayers(s);
      if (!layers) return;
      const selectedIds = Array.from(new Set(s.selection.layerIds));
      const clipboard = selectedIds
        .map((id) => layers[id])
        .filter((layer): layer is Layer => Boolean(layer))
        .map((layer) => JSON.parse(JSON.stringify(layer)) as Layer);
      editorStoreApi.setState({ layerClipboard: clipboard });
    },

    pasteLayers() {
      editorStoreApi.setState((s) => {
        if (s.layerClipboard.length === 0) return s;
        const layers = readCurrentLayers(s);
        if (!layers) return s;

        const newIds: string[] = [];
        const patch = writeCurrentLayers(s, (prev) => {
          const nextLayers = { ...prev };
          const usedIds = new Set(Object.keys(nextLayers));
          const idMap = new Map<string, string>();
          const cloned: Layer[] = [];
          for (const clipLayer of s.layerClipboard) {
            let candidate = `${clipLayer.id}-copy`;
            let n = 1;
            while (usedIds.has(candidate)) {
              n += 1;
              candidate = `${clipLayer.id}-copy-${n}`;
            }
            usedIds.add(candidate);
            idMap.set(clipLayer.id, candidate);
            // Pasting into a guide master strips fields that refer back to
            // icon-scoped context and can't be honoured on a master:
            //   - `importMeta` — SVG-import provenance of the source icon
            //   - `role` — variable-value bucket (icon-only)
            //   - `groupId` — references an icon layer group
            //   - `drawOrder` — draw-animation ordering on an icon variant
            // Masks are preserved when the mask + masked layers are pasted
            // together; cross-scope dangling references are dropped below.
            const normalised =
              s.editScope.kind === 'guideMaster'
                ? normaliseLayerForGuideScope(clipLayer)
                : (JSON.parse(JSON.stringify(clipLayer)) as Layer);
            cloned.push(normalised);
          }
          for (const clone of cloned) {
            const newId = idMap.get(clone.id)!;
            const remapped = remapLayerReferences({ ...clone, id: newId }, idMap);
            // Drop a clip reference that doesn't resolve in the new scope.
            if (
              remapped.clipPathLayerId &&
              !nextLayers[remapped.clipPathLayerId] &&
              !idMap.has(remapped.clipPathLayerId)
            ) {
              remapped.clipPathLayerId = undefined;
            }
            nextLayers[newId] = remapped;
            newIds.push(newId);
          }
          return nextLayers;
        });
        if (!patch) return s;
        return {
          ...patch,
          selection: {
            layerIds: newIds,
            pointIds: [],
            guideIndexes: s.selection.guideIndexes ?? [],
          },
        };
      });
    },

    duplicateSelectedLayers() {
      editorStoreApi.setState((s) => {
        const selectedIds = Array.from(new Set(s.selection.layerIds));
        if (selectedIds.length === 0) return s;
        const layers = readCurrentLayers(s);
        if (!layers) return s;

        const newIds: string[] = [];
        const patch = writeCurrentLayers(s, (prev) => {
          const nextLayers = { ...prev };
          const usedIds = new Set(Object.keys(nextLayers));
          const idMap = new Map<string, string>();
          const srcLayers: Layer[] = [];
          for (const srcId of selectedIds) {
            const src = prev[srcId];
            if (!src) continue;
            let candidate = `${srcId}-copy`;
            let n = 1;
            while (usedIds.has(candidate)) {
              n += 1;
              candidate = `${srcId}-copy-${n}`;
            }
            usedIds.add(candidate);
            idMap.set(srcId, candidate);
            srcLayers.push(src);
          }
          for (const src of srcLayers) {
            const newId = idMap.get(src.id)!;
            const clone = JSON.parse(JSON.stringify(src)) as Layer;
            const remapped = remapLayerReferences({ ...clone, id: newId }, idMap);
            nextLayers[newId] = remapped;
            newIds.push(newId);
          }
          return newIds.length > 0 ? nextLayers : prev;
        });
        if (!patch) return s;
        return {
          ...patch,
          selection: {
            layerIds: newIds,
            pointIds: [],
            guideIndexes: s.selection.guideIndexes ?? [],
          },
        };
      });
    },

    reorderSelectedLayers(direction) {
      editorStoreApi.setState((s) => {
        const selected = new Set(s.selection.layerIds);
        if (selected.size === 0) return s;
        const layers = readCurrentLayers(s);
        if (!layers) return s;

        return (
          writeCurrentLayers(s, (prev) => {
            const keys = Object.keys(prev);
            const selectedKeys = keys.filter((k) => selected.has(k));
            const unselectedKeys = keys.filter((k) => !selected.has(k));
            if (selectedKeys.length === 0) return prev;

            let nextKeys: string[];
            if (direction === 'front') {
              nextKeys = [...unselectedKeys, ...selectedKeys];
            } else if (direction === 'back') {
              nextKeys = [...selectedKeys, ...unselectedKeys];
            } else {
              nextKeys = [...keys];
              const delta = direction === 'up' ? -1 : 1;
              const indices = selectedKeys
                .map((k) => keys.indexOf(k))
                .sort((a, b) => (delta < 0 ? a - b : b - a));
              for (const idx of indices) {
                const target = idx + delta;
                if (target < 0 || target >= nextKeys.length) continue;
                const tmp = nextKeys[idx]!;
                nextKeys[idx] = nextKeys[target]!;
                nextKeys[target] = tmp;
              }
            }

            const nextLayers: Record<string, Layer> = {};
            for (const k of nextKeys) {
              const layer = prev[k];
              if (layer) nextLayers[k] = layer;
            }
            return nextLayers;
          }) ?? s
        );
      });
    },

    moveLayerToIndex(layerId, index) {
      editorStoreApi.setState((s) => {
        const layers = readCurrentLayers(s);
        if (!layers) return s;

        return (
          writeCurrentLayers(s, (prev) => {
            const keys = Object.keys(prev);
            const srcIdx = keys.indexOf(layerId);
            if (srcIdx < 0) return prev;
            const clamped = Math.max(0, Math.min(keys.length - 1, index));
            if (srcIdx === clamped) return prev;

            const nextKeys = [...keys];
            nextKeys.splice(srcIdx, 1);
            const insertAt = srcIdx < clamped ? clamped - 1 : clamped;
            nextKeys.splice(insertAt, 0, layerId);
            const nextLayers: Record<string, Layer> = {};
            for (const k of nextKeys) {
              const layer = prev[k];
              if (layer) nextLayers[k] = layer;
            }
            return nextLayers;
          }) ?? s
        );
      });
    },

    pauseHistory() {
      temporalState.pause();
    },

    resumeHistory() {
      temporalState.resume();
    },

    commitHistory(label?: string) {
      temporalState.commit(label);
    },

    toggleNavPane() {
      editorStoreApi.setState((s) => ({ navPaneExpanded: !s.navPaneExpanded }));
    },

    toggleListPane() {
      editorStoreApi.setState((s) => ({ listPaneExpanded: !s.listPaneExpanded }));
    },

    setSelectedIconIds(ids) {
      editorStoreApi.setState({ selectedIconIds: ids });
    },

    toggleIconSelection(iconId) {
      editorStoreApi.setState((s) => {
        const set = new Set(s.selectedIconIds);
        if (set.has(iconId)) set.delete(iconId);
        else set.add(iconId);
        return { selectedIconIds: [...set] };
      });
    },

    clearIconSelection() {
      editorStoreApi.setState({ selectedIconIds: [] });
    },

    async applyBoolean(mode) {
      const snapshot = editorStoreApi.getState();
      const layers = readCurrentLayers(snapshot);
      const selectedLayerIds = Array.from(new Set(snapshot.selection.layerIds));
      if (!layers || selectedLayerIds.length < 2) return;

      const selectedLayers = selectedLayerIds.map((layerId) => ({
        layerId,
        layer: layers[layerId],
      }));
      if (selectedLayers.some(({ layer }) => !layer?.path?.d)) return;

      // W2-2: build the non-destructive compound metadata alongside
      // the cached evaluation. The author's selected operand order
      // (selection-list order) is preserved in the tree.
      const operandData = selectedLayers.map(({ layer }) => ({
        d: layer.path!.d,
      }));
      let result = operandData[0]!.d;
      for (let i = 1; i < operandData.length; i++) {
        result = await booleanOp(mode, result, operandData[i]!.d);
      }
      const primaryLayerId = selectedLayerIds[0]!;
      const compoundMeta = buildLeftLeaningCompound(
        mode,
        operandData,
        primaryLayerId,
      );

      temporalState.pause();
      try {
        editorStoreApi.setState((s) => {
          const live = readCurrentLayers(s);
          const primaryLayer = live?.[primaryLayerId];
          if (!live || !primaryLayer?.path) return s;

          // If the primary layer was already a compound, bump
          // cacheVersion atop the previous so resolver memo keys
          // strictly increase on every edit.
          const nextCacheVersion = primaryLayer.compound
            ? primaryLayer.compound.cacheVersion + 1
            : compoundMeta.cacheVersion;
          const nextCompound = { ...compoundMeta, cacheVersion: nextCacheVersion };

          const patch = writeCurrentLayers(s, (prev) => {
            const next = { ...prev };
            // Uphold the primitive-invariant: clear any stale `primitive`
            // on the survivor and stamp `formerPrimitiveKind` so the
            // Inspector can explain the regression. Then drop the
            // consumed layers.
            const { primitive: dropped, formerCompound: _droppedFC, ...withoutMeta } = primaryLayer;
            next[primaryLayerId] = {
              ...withoutMeta,
              ...(dropped ? { formerPrimitiveKind: dropped.kind } : {}),
              path: { ...primaryLayer.path, d: result },
              compound: nextCompound,
            };
            for (const layerId of selectedLayerIds.slice(1)) {
              delete next[layerId];
            }
            return next;
          });
          if (!patch) return s;
          return {
            ...patch,
            selection: { layerIds: [primaryLayerId], pointIds: [] },
          };
        });
      } finally {
        temporalState.resume();
        temporalState.commit(`boolean:${mode}`);
      }
    },

    flattenCompound(iconId, layerId) {
      editorStoreApi.setState((s) => {
        if (s.editScope.kind === 'icon' && iconId !== s.currentIconId) return s;
        const live = readCurrentLayers(s);
        const layer = live?.[layerId];
        if (!live || !layer?.compound) return s;
        const patch = writeCurrentLayers(s, (prev) => {
          const next = { ...prev };
          const { compound: _dropped, ...withoutCompound } = layer;
          next[layerId] = {
            ...withoutCompound,
            // Stamp the breadcrumb so the Inspector can explain the
            // operand tree is gone.
            formerCompound: true,
          };
          return next;
        });
        return patch ?? s;
      });
      temporalState.commit('compound:flatten');
    },

    convertToGroup(iconId, layerId) {
      editorStoreApi.setState((s) => {
        if (s.editScope.kind === 'icon' && iconId !== s.currentIconId) return s;
        const live = readCurrentLayers(s);
        const layer = live?.[layerId];
        if (!live || !layer?.compound) return s;
        const operandIds = operandIdsInTree(layer.compound.tree);
        const assignedSiblingIds: string[] = [];
        const patch = writeCurrentLayers(s, (prev) => {
          const next = { ...prev };
          // Replace the compound layer with one sibling layer per
          // operand. Sibling ids derive from `${layerId}/${operandId}`,
          // with a `~N` suffix loop to avoid clobbering an existing
          // layer id (W2 audit §1: prevent the silent-overwrite
          // footgun if a previous convertToGroup or unrelated layer
          // already occupies the canonical slot).
          delete next[layerId];
          for (const opId of operandIds) {
            const operand = layer.compound!.operands[opId];
            if (!operand) continue;
            let siblingId = `${layerId}/${opId}`;
            let dedupeIndex = 1;
            while (next[siblingId]) {
              siblingId = `${layerId}/${opId}~${dedupeIndex++}`;
            }
            assignedSiblingIds.push(siblingId);
            next[siblingId] = {
              ...layer,
              id: siblingId,
              compound: undefined,
              formerCompound: undefined,
              primitive: undefined,
              formerPrimitiveKind: undefined,
              path: {
                ...(layer.path ?? { d: '' }),
                d: operand.d,
              },
              transform: operand.transform ?? layer.transform,
            };
          }
          return next;
        });
        if (!patch) return s;
        return {
          ...patch,
          selection: {
            layerIds: assignedSiblingIds,
            pointIds: [],
          },
        };
      });
      temporalState.commit('compound:convertToGroup');
    },

    async applyDerivedVariant(iconId, spec) {
      const snapshot = editorStoreApi.getState();
      // Icon-scope only: derived variants are a variant-level concept.
      if (snapshot.editScope.kind !== 'icon') return;
      if (!snapshot.project) return;
      const icon = snapshot.project.icons[iconId];
      if (!icon) return;

      editorStoreApi.setState({ isDeriving: true });
      temporalState.pause();
      try {
        const { applyDerivedVariant: derive } = await import(
          '@/lib/schema/variant-derivation'
        );
        const derivedIcon = await derive(icon, spec);

        editorStoreApi.setState((s) => {
          if (!s.project) return s;
          return {
            project: {
              ...s.project,
              icons: {
                ...s.project.icons,
                [iconId]: derivedIcon,
              },
            },
          };
        });
      } finally {
        editorStoreApi.setState({ isDeriving: false });
        temporalState.resume();
        temporalState.commit(`derive:${spec.modifier}`);
      }
    },
  };
}

currentState = {
  ...initialState,
  ...createActions(),
};

export const editorStore = editorStoreApi;

function clampInteger(value: number, minimum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.max(minimum, Math.round(value));
}

const SYMBOL_WEIGHT_ORDER: SymbolWeight[] = [
  'ultralight',
  'thin',
  'light',
  'regular',
  'medium',
  'semibold',
  'bold',
  'heavy',
  'black',
];

const SYMBOL_SCALE_ORDER: SymbolScale[] = ['small', 'medium', 'large'];

function pickClosestVariant(
  variants: Record<string, Variant>,
  targetSize: number,
  targetWeight: SymbolWeight,
  targetScale: SymbolScale,
  preferredVariantId?: string,
): Variant | null {
  if (preferredVariantId && variants[preferredVariantId]) {
    return variants[preferredVariantId]!;
  }

  const entries = Object.values(variants);
  if (entries.length === 0) return null;

  const weightIndex = SYMBOL_WEIGHT_ORDER.indexOf(targetWeight);
  const scaleIndex = SYMBOL_SCALE_ORDER.indexOf(targetScale);

  let best: Variant | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const variant of entries) {
    const currentWeightIndex = variant.weight
      ? SYMBOL_WEIGHT_ORDER.indexOf(variant.weight)
      : SYMBOL_WEIGHT_ORDER.indexOf('regular');
    const currentScaleIndex = variant.scale
      ? SYMBOL_SCALE_ORDER.indexOf(variant.scale)
      : SYMBOL_SCALE_ORDER.indexOf('medium');

    const score =
      Math.abs(variant.size - targetSize) * 100 +
      Math.abs(currentWeightIndex - weightIndex) * 10 +
      Math.abs(currentScaleIndex - scaleIndex);

    if (score < bestScore) {
      bestScore = score;
      best = variant;
    }
  }

  return best;
}

function ensureUniqueIconId(candidate: string, existingIds: string[]): string {
  return ensureUniqueRecordId(candidate, existingIds);
}

function ensureUniqueRecordId(candidate: string, existingIds: string[]): string {
  if (!existingIds.includes(candidate)) return candidate;

  let counter = 2;
  let nextId = `${candidate}-${counter}`;
  while (existingIds.includes(nextId)) {
    counter += 1;
    nextId = `${candidate}-${counter}`;
  }
  return nextId;
}

function toKebabCase(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildDisplayName(candidate: string, existingNames: string[]) {
  const trimmed = candidate.trim() || 'Untitled';
  if (!existingNames.includes(trimmed)) return trimmed;

  let counter = 2;
  let nextName = `${trimmed} ${counter}`;
  while (existingNames.includes(nextName)) {
    counter += 1;
    nextName = `${trimmed} ${counter}`;
  }
  return nextName;
}

function hasClipMaskTargets(layers: Record<string, Layer>, clipLayerId: string): boolean {
  return Object.values(layers).some(
    (layer) => layer.id !== clipLayerId && layer.clipPathLayerId === clipLayerId,
  );
}

/**
 * Strip Icon-scope-specific metadata from a Layer so pasting it onto a
 * guide master doesn't orphan references to icon variants, components,
 * or import provenance.
 */
function normaliseLayerForGuideScope(layer: Layer): Layer {
  const clone = JSON.parse(JSON.stringify(layer)) as Layer;
  delete clone.importMeta;
  delete clone.role;
  delete clone.groupId;
  delete clone.drawOrder;
  return clone;
}
