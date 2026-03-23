import type {
  Project,
  Workspace,
  IconSet,
  Icon,
  Layer,
  State,
  TopologyContract,
  Transition,
  Effect,
  GuideMaster,
  GuideSet,
  GuideItem,
  Collection,
  SymbolComponent,
  SymbolScale,
  SymbolWeight,
  Variant,
  RenderingMode,
  GitHubSyncSettings,
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
import { getDefaultGuideMaster } from '@/lib/editor-core/guide-presets';
import { areTopologiesCompatible, computeTopology } from '@/lib/editor-core/topology';
import type { SnapTarget } from '@/lib/editor-core/snap-engine';
import type { InterpolatedValues, ResolvedTransition, CrossIconContext } from '@/lib/runtime-core';
import { resolveTransition, interpolateTransitionValues } from '@/lib/runtime-core';

export type EditorState = {
  workspace: Workspace | null;
  project: Project | null;
  activeIconSetId: string | null;
  isDirty: boolean;
  /** UX-F8: Timestamp of last successful save */
  lastSavedAt: number | null;
  currentIconId: string | null;
  currentVariantId: string | null;
  currentStateId: string | null;
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
  pointMarquee: PointMarqueeState | null;
  pointTransformLabel: PointTransformLabelState | null;
  pendingPenHandle: PendingPenHandleState | null;
  transitionPreview: TransitionPreview | null;
  selectedTransitionId: string | null;
  favorites: string[];
  openTabs: EditorTab[];
  activeTabId: string | null;
};

export type EditorTab = {
  id: string;
  iconSetId: string;
  iconId: string;
  variantId: string | null;
  stateId: string | null;
};

export type TransitionPreview = {
  transitionId: string;
  baseStateId: string;
  targetStateId: string;
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
  createBlankIcon(options?: { name?: string; size?: number }): string | null;
  insertIcon(icon: Icon): void;
  renameIcon(iconId: string, name: string): void;
  duplicateIcon(iconId: string): string | null;
  removeIcon(iconId: string): void;
  addVariant(iconId: string, variant: VariantInput): void;
  removeVariant(iconId: string, variantId: string): void;
  patchVariant(iconId: string, variantId: string, patch: VariantPatch): void;
  addState(iconId: string, options?: { name?: string; sourceStateId?: string | null; blank?: boolean }): string | null;
  renameState(iconId: string, stateId: string, nextStateId: string): string | null;
  duplicateState(iconId: string, stateId: string, nextStateId?: string): string | null;
  removeState(iconId: string, stateId: string): void;
  addTransition(iconId: string, transition: Transition): void;
  removeTransition(iconId: string, transitionId: string): void;
  patchTransition(iconId: string, transitionId: string, patch: Partial<Transition>): void;
  addEffect(iconId: string, effect: Effect): void;
  removeEffect(iconId: string, effectId: string): void;
  patchEffect(iconId: string, effectId: string, patch: Partial<Effect>): void;
  duplicateLayersToVariant(
    iconId: string,
    fromVariantId: string,
    toVariantId: string,
    stateId?: string,
  ): void;
  setCurrentIcon(id: string): void;
  setCurrentVariant(id: string): void;
  setCurrentState(id: string): void;
  setStateTopology(iconId: string, stateId: string, topology: TopologyContract | undefined): void;
  setSelectedIconGuideIndex(index: number | null): void;
  patchLayer(iconId: string, stateId: string, layerId: string, patch: Partial<Layer>): void;
  renameLayer(iconId: string, stateId: string, oldLayerId: string, newLayerId: string): void;
  setLayerVisibility(iconId: string, stateId: string, layerId: string, visible: boolean): void;
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
  setPointMarquee(marquee: PointMarqueeState | null): void;
  setPointTransformLabel(label: PointTransformLabelState | null): void;
  setPendingPenHandle(handle: PendingPenHandleState | null): void;
  setTransitionPreview(preview: TransitionPreview | null): void;
  startTransitionPreview(
    iconId: string,
    transition: Transition,
    variantId: string,
    progress?: number,
    crossIconContext?: CrossIconContext,
  ): void;
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
  updateIconSetSync(iconSetId: string, sync: GitHubSyncSettings | undefined): void;
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
  pauseHistory(): void;
  resumeHistory(): void;
  commitHistory(label?: string): void;
  applyBoolean(mode: BooleanMode): Promise<void>;
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
  defaultState?: string;
  states?: Record<string, State>;
};

export type VariantPatch = Partial<
  Pick<Variant, 'size' | 'viewBox' | 'renderingMode' | 'weight' | 'scale' | 'variableValue'>
>;

type LegacyVariant = Variant & {
  guideSetId?: string;
  states?: Record<string, State>;
};

type LegacyIcon = Omit<Icon, 'variants'> & {
  variants: Record<string, LegacyVariant>;
  states?: Record<string, State>;
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
  currentIconId: null,
  currentVariantId: null,
  currentStateId: null,
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
  pointMarquee: null,
  pointTransformLabel: null,
  pendingPenHandle: null,
  transitionPreview: null,
  selectedTransitionId: null,
  favorites: [],
  openTabs: [],
  activeTabId: null,
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
) {
  pastStates.push({ workspace, project, activeIconSetId, isDirty });
  if (pastStates.length > MAX_HISTORY) pastStates.shift();
  futureStates.length = 0;
}

function applySnapshot(snapshot: TemporalSnapshot) {
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
    });
    applySnapshot(next);
  },

  clear() {
    pastStates.length = 0;
    futureStates.length = 0;
    transactionBase = undefined;
  },

  pause() {
    if (!tracking) return;
    tracking = false;
    transactionBase = {
      workspace: currentState.workspace,
      project: currentState.project,
      activeIconSetId: currentState.activeIconSetId,
      isDirty: currentState.isDirty,
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
                  stateId: next.currentStateId,
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
        pushHistorySnapshot(prev.workspace, prev.project, prev.activeIconSetId, prev.isDirty);
      } else if (transactionBase === undefined) {
        transactionBase = {
          workspace: prev.workspace,
          project: prev.project,
          activeIconSetId: prev.activeIconSetId,
          isDirty: prev.isDirty,
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
      const legacyStates = icon.states ?? {};
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
          };
        }
      }

      const migratedVariants = Object.fromEntries(
        Object.entries(variants).map(([variantId, variant]) => {
          const {
            guideSetId: legacyGuideSetId,
            states: variantStates,
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
              states: cloneStateRecord(variantStates ?? legacyStates),
            },
          ];
        }),
      ) as Icon['variants'];
      const { guides: _guides, states: _legacyStates, ...restIcon } = icon;

      return [
        iconId,
        {
          ...restIcon,
          variants: migratedVariants,
        },
      ];
    }),
  ) as Project['icons'];

  return {
    ...project,
    icons: nextIcons,
    guideMasters: Object.keys(nextGuideMasters).length > 0 ? nextGuideMasters : undefined,
  };
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

function cloneStateRecord(states: Record<string, State>): Record<string, State> {
  return Object.fromEntries(
    Object.entries(states).map(([stateId, state]) => [
      stateId,
      {
        ...state,
        layers: Object.fromEntries(
          Object.entries(state.layers).map(([layerId, layer]) => [layerId, cloneLayer(layer)]),
        ),
        topology: state.topology
          ? {
              ...state.topology,
              layerPairs: state.topology.layerPairs.map((pair) => ({
                ...pair,
                commandSignature: [...pair.commandSignature],
                closed: [...pair.closed],
              })),
            }
          : undefined,
      },
    ]),
  );
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

function replaceVariantState(
  icon: Icon,
  variantId: string,
  stateId: string,
  nextState: State,
): Icon {
  const variant = icon.variants[variantId];
  if (!variant) return icon;

  return {
    ...icon,
    variants: {
      ...icon.variants,
      [variantId]: {
        ...variant,
        states: {
          ...variant.states,
          [stateId]: nextState,
        },
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

function getFirstStateId(
  project: Project | null | undefined,
  iconId: string | null | undefined,
  variantId: string | null | undefined,
) {
  if (!project || !iconId || !variantId) return null;
  return Object.keys(project.icons[iconId]?.variants[variantId]?.states ?? {})[0] ?? null;
}

function buildEditorTarget(project: Project | null | undefined, requestedIconId?: string | null) {
  const iconId =
    requestedIconId && project?.icons[requestedIconId] ? requestedIconId : getFirstIconId(project);
  const variantId = getFirstVariantId(project, iconId);
  const stateId = getFirstStateId(project, iconId, variantId);

  return {
    iconId,
    variantId,
    stateId,
    renderingMode: getResolvedRenderingMode(
      variantId && iconId && project ? project.icons[iconId]?.variants[variantId] : null,
    ),
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

function createEmptyState(stateId = 'default'): State {
  return {
    id: stateId,
    layers: {},
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

  return {
    id: toKebabCase(name) || 'new-icon',
    name,
    variants: {
      [variantId]: {
        id: variantId,
        name: String(size),
        size,
        viewBox: [0, 0, size, size],
        guideMasterId,
        defaultState: 'default',
        states: {
          default: createEmptyState(),
        },
      },
    },
    transitions: {},
  };
}

function buildWorkspaceState(
  workspace: Workspace,
  activeIconSetId?: string | null,
  options?: { requestedIconId?: string | null; keepTabs?: boolean; previousState?: EditorStore },
): Partial<EditorStore> {
  const resolvedIconSetId = activeIconSetId ?? getFirstIconSetId(workspace);
  const project = getActiveIconSet(workspace, resolvedIconSetId);
  const target = buildEditorTarget(project, options?.requestedIconId);

  const baseState = options?.previousState;
  const existingTabs = options?.keepTabs ? (baseState?.openTabs ?? []) : [];
  const activeTabId = options?.keepTabs ? (baseState?.activeTabId ?? null) : null;

  return {
    workspace,
    project,
    activeIconSetId: resolvedIconSetId,
    currentIconId: target.iconId,
    currentVariantId: target.variantId,
    currentStateId: target.stateId,
    renderingMode: target.renderingMode,
    selectedIconGuideIndex: null,
    selection: { layerIds: [], pointIds: [] },
    activeSnapGuides: [],
    snapEnabled: true,
    guidesVisible: true,
    guideStyle: 'subtle',
    viewport: { zoom: 12, panX: 0, panY: 0 },
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
          migrateProjectForGuideMasters(iconSet),
        ]),
      );
      const migratedWorkspace: Workspace = {
        ...workspace,
        iconSets: migratedIconSets,
        activeIconSetId:
          workspace.activeIconSetId && migratedIconSets[workspace.activeIconSetId]
            ? workspace.activeIconSetId
            : (getFirstIconSetId({
                ...workspace,
                iconSets: migratedIconSets,
              }) ?? undefined),
      };

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
      const workspace = createWorkspaceFromProject(migrateProjectForGuideMasters(project));
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
      const nextVariantId = Object.keys(nextIcon.variants)[0] ?? null;
      const nextStateId = nextVariantId
        ? (nextIcon.variants[nextVariantId]?.defaultState ??
          Object.keys(nextIcon.variants[nextVariantId]?.states ?? {})[0] ??
          null)
        : null;

      editorStoreApi.setState((s) => ({
        project: {
          ...s.project!,
          meta: { ...s.project!.meta, updatedAt: new Date().toISOString() },
          icons: {
            ...s.project!.icons,
            [nextIconId]: nextIcon,
          },
        },
        currentIconId: nextIconId,
        currentVariantId: nextVariantId,
        currentStateId: nextStateId,
        renderingMode: getResolvedRenderingMode(
          nextVariantId ? nextIcon.variants[nextVariantId] : null,
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
        const nextVariantId = Object.keys(nextIcon.variants)[0] ?? null;
        const nextStateId = nextVariantId
          ? (Object.keys(nextIcon.variants[nextVariantId]?.states ?? {})[0] ?? null)
          : null;

        return {
          project: {
            ...project,
            meta: { ...project.meta, updatedAt: now },
            icons: {
              ...project.icons,
              [nextIconId]: nextIcon,
            },
          },
          currentIconId: nextIconId,
          currentVariantId: nextVariantId,
          currentStateId: nextStateId,
          renderingMode: getResolvedRenderingMode(
            nextVariantId ? nextIcon.variants[nextVariantId] : null,
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

        const duplicate = structuredClone(icon) as Icon;
        const nextIconId = ensureUniqueIconId(`${icon.id}-copy`, Object.keys(s.project.icons));
        const nextIconName = buildDisplayName(`${icon.name} Copy`, Object.values(s.project.icons).map((entry) => entry.name));
        duplicate.id = nextIconId;
        duplicate.name = nextIconName;

        const nextVariantId = Object.keys(duplicate.variants)[0] ?? null;
        const nextStateId = nextVariantId ? duplicate.variants[nextVariantId]?.defaultState ?? Object.keys(duplicate.variants[nextVariantId]?.states ?? {})[0] ?? null : null;
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
          currentStateId: nextStateId,
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
        const nextStateId = getFirstStateId({ ...s.project, icons: nextIcons }, nextIconId, nextVariantId);
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
          currentStateId: nextStateId,
          renderingMode: getResolvedRenderingMode(
            nextIconId && nextVariantId ? nextIcons[nextIconId]?.variants[nextVariantId] : null,
          ),
          openTabs: nextTabs,
          activeTabId: nextActiveTabId,
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
        const nextStates = cloneStateRecord(variantInput.states ?? sourceVariant.states);
        const nextViewBox =
          variantInput.viewBox && variantInput.viewBox[2] > 0 && variantInput.viewBox[3] > 0
            ? variantInput.viewBox
            : scaleViewBoxToSize(sourceVariant.viewBox, variantInput.size);

        const nextVariant: Variant = {
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
          defaultState:
            variantInput.defaultState ??
            sourceVariant.defaultState ??
            Object.keys(nextStates)[0] ??
            'default',
          states: nextStates,
        };

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
          currentStateId:
            (s.currentStateId && nextVariant.states[s.currentStateId] ? s.currentStateId : null) ??
            nextVariant.defaultState ??
            Object.keys(nextVariant.states)[0] ??
            null,
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
        const fallbackStateId =
          fallbackVariant && s.currentVariantId === variantId
            ? ((s.currentStateId && fallbackVariant.states[s.currentStateId]
                ? s.currentStateId
                : fallbackVariant.defaultState) ??
              Object.keys(fallbackVariant.states)[0] ??
              null)
            : s.currentStateId;

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
          currentStateId: fallbackStateId,
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

        if (
          nextSize === variant.size &&
          nextViewBox === variant.viewBox &&
          nextRenderingMode === variant.renderingMode &&
          nextWeight === variant.weight &&
          nextScale === variant.scale
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
                    size: nextSize,
                    viewBox: nextViewBox,
                    renderingMode: nextRenderingMode,
                    weight: nextWeight,
                    scale: nextScale,
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

    addState(iconId, options) {
      let createdStateId: string | null = null;
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        const icon = s.project.icons[iconId];
        if (!icon) return s;

        const existingStateIds = Array.from(
          new Set(
            Object.values(icon.variants).flatMap((variant) => Object.keys(variant.states)),
          ),
        );
        const requestedId = toKebabCase(options?.name?.trim() || 'new-state') || 'new-state';
        const nextStateId = ensureUniqueRecordId(requestedId, existingStateIds);
        const sourceStateId = options?.sourceStateId ?? s.currentStateId ?? null;

        const nextVariants = Object.fromEntries(
          Object.entries(icon.variants).map(([variantId, variant]) => {
            const sourceState =
              !options?.blank && sourceStateId ? variant.states[sourceStateId] : undefined;
            return [
              variantId,
              {
                ...variant,
                states: {
                  ...variant.states,
                  [nextStateId]: sourceState
                    ? cloneStateRecord({ [nextStateId]: { ...sourceState, id: nextStateId } })[nextStateId]!
                    : createEmptyState(nextStateId),
                },
              },
            ];
          }),
        ) as Icon['variants'];

        createdStateId = nextStateId;
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
          currentStateId: nextStateId,
          selection: { layerIds: [], pointIds: [] },
          activeSnapGuides: [],
          pointMarquee: null,
          transitionPreview: null,
        };
      });
      return createdStateId;
    },

    renameState(iconId, stateId, nextStateId) {
      const trimmed = toKebabCase(nextStateId);
      if (!trimmed) return null;

      let renamedStateId: string | null = null;
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        const icon = s.project.icons[iconId];
        if (!icon) return s;
        if (trimmed === stateId) {
          renamedStateId = stateId;
          return s;
        }

        const existingStateIds = Array.from(
          new Set(
            Object.values(icon.variants).flatMap((variant) =>
              Object.keys(variant.states).filter((id) => id !== stateId),
            ),
          ),
        );
        const resolvedStateId = ensureUniqueRecordId(trimmed, existingStateIds);
        const nextVariants = Object.fromEntries(
          Object.entries(icon.variants).map(([variantId, variant]) => {
            const state = variant.states[stateId];
            if (!state) return [variantId, variant];

            const nextStates = { ...variant.states };
            delete nextStates[stateId];
            nextStates[resolvedStateId] = cloneStateRecord({
              [resolvedStateId]: {
                ...state,
                id: resolvedStateId,
              },
            })[resolvedStateId]!;

            return [
              variantId,
              {
                ...variant,
                defaultState: variant.defaultState === stateId ? resolvedStateId : variant.defaultState,
                states: nextStates,
              },
            ];
          }),
        ) as Icon['variants'];

        const nextTransitions = Object.fromEntries(
          Object.entries(icon.transitions).map(([transitionId, transition]) => [
            transitionId,
            {
              ...transition,
              from: transition.from === stateId ? resolvedStateId : transition.from,
              to: transition.to === stateId ? resolvedStateId : transition.to,
            },
          ]),
        );

        renamedStateId = resolvedStateId;
        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...icon,
                variants: nextVariants,
                transitions: nextTransitions,
              },
            },
          },
          currentStateId: s.currentStateId === stateId ? resolvedStateId : s.currentStateId,
          transitionPreview: null,
        };
      });

      return renamedStateId;
    },

    duplicateState(iconId, stateId, nextStateId) {
      return editorStoreApi.getState().addState(iconId, {
        name: nextStateId || `${stateId}-copy`,
        sourceStateId: stateId,
      });
    },

    removeState(iconId, stateId) {
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        const icon = s.project.icons[iconId];
        if (!icon) return s;
        const variantsWithState = Object.values(icon.variants).filter((variant) => variant.states[stateId]);
        if (variantsWithState.length === 0) return s;
        if (variantsWithState.some((variant) => Object.keys(variant.states).length <= 1)) return s;

        const nextVariants = Object.fromEntries(
          Object.entries(icon.variants).map(([variantId, variant]) => {
            if (!variant.states[stateId]) return [variantId, variant];

            const nextStates = { ...variant.states };
            delete nextStates[stateId];
            const fallbackStateId =
              variant.defaultState === stateId ? Object.keys(nextStates)[0] ?? variant.defaultState : variant.defaultState;

            return [
              variantId,
              {
                ...variant,
                defaultState: fallbackStateId,
                states: nextStates,
              },
            ];
          }),
        ) as Icon['variants'];

        const nextTransitions = Object.fromEntries(
          Object.entries(icon.transitions).filter(([, transition]) => transition.from !== stateId && transition.to !== stateId),
        );

        const fallbackCurrentStateId =
          s.currentStateId === stateId
            ? Object.keys(Object.values(nextVariants)[0]?.states ?? {})[0] ?? null
            : s.currentStateId;

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...icon,
                variants: nextVariants,
                transitions: nextTransitions,
              },
            },
          },
          currentStateId: fallbackCurrentStateId,
          selectedTransitionId:
            s.selectedTransitionId && icon.transitions[s.selectedTransitionId] && (icon.transitions[s.selectedTransitionId]?.from === stateId || icon.transitions[s.selectedTransitionId]?.to === stateId)
              ? null
              : s.selectedTransitionId,
          transitionPreview: null,
          selection: { layerIds: [], pointIds: [] },
          activeSnapGuides: [],
          pointMarquee: null,
        };
      });
    },

    addTransition(iconId, transition) {
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        const icon = s.project.icons[iconId];
        if (!icon) return s;

        const nextTransitionId = ensureUniqueRecordId(transition.id, Object.keys(icon.transitions));
        const nextTransition =
          nextTransitionId === transition.id
            ? transition
            : {
                ...transition,
                id: nextTransitionId,
              };

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...icon,
                transitions: {
                  ...icon.transitions,
                  [nextTransition.id]: nextTransition,
                },
              },
            },
          },
        };
      });
    },

    removeTransition(iconId, transitionId) {
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        const icon = s.project.icons[iconId];
        if (!icon?.transitions[transitionId]) return s;

        const nextTransitions = { ...icon.transitions };
        delete nextTransitions[transitionId];

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...icon,
                transitions: nextTransitions,
              },
            },
          },
          transitionPreview:
            s.transitionPreview?.transitionId === transitionId ? null : s.transitionPreview,
          selectedTransitionId:
            s.selectedTransitionId === transitionId ? null : s.selectedTransitionId,
        };
      });
    },

    patchTransition(iconId, transitionId, patch) {
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        const icon = s.project.icons[iconId];
        const transition = icon?.transitions[transitionId];
        if (!icon || !transition) return s;

        const { id: _ignoredId, ...safePatch } = patch;

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...icon,
                transitions: {
                  ...icon.transitions,
                  [transitionId]: {
                    ...transition,
                    ...safePatch,
                  },
                },
              },
            },
          },
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

    duplicateLayersToVariant(iconId, fromVariantId, toVariantId, stateId) {
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        const icon = s.project.icons[iconId];
        const fromVariant = icon?.variants[fromVariantId];
        const toVariant = icon?.variants[toVariantId];
        if (!icon || !fromVariant || !toVariant) return s;

        const nextStates = { ...toVariant.states };
        if (stateId) {
          const sourceState = fromVariant.states[stateId];
          if (!sourceState) return s;
          nextStates[stateId] = {
            ...sourceState,
            layers: cloneStateRecord({ [stateId]: sourceState })[stateId]!.layers,
            topology: sourceState.topology
              ? cloneStateRecord({ [stateId]: sourceState })[stateId]!.topology
              : undefined,
          };
        } else {
          Object.assign(nextStates, cloneStateRecord(fromVariant.states));
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
                  [toVariantId]: {
                    ...toVariant,
                    states: nextStates,
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
        const nextVariantId = Object.keys(icon.variants)[0] ?? null;
        return {
          currentIconId: id,
          currentVariantId: nextVariantId,
          currentStateId: nextVariantId
            ? (Object.keys(icon.variants[nextVariantId]?.states ?? {})[0] ?? null)
            : null,
          renderingMode: getResolvedRenderingMode(
            nextVariantId ? icon.variants[nextVariantId] : null,
          ),
          selectedIconGuideIndex: null,
          selection: { layerIds: [], pointIds: [] },
          activeSnapGuides: [],
          pointMarquee: null,
          transitionPreview: null,
        };
      });
    },

    setCurrentVariant(id) {
      editorStoreApi.setState((s) => {
        const icon = s.currentIconId ? s.project?.icons[s.currentIconId] : null;
        const variant = icon?.variants[id];
        if (!variant) return s;

        const nextStateId =
          (s.currentStateId && variant.states[s.currentStateId] ? s.currentStateId : null) ??
          variant.defaultState ??
          Object.keys(variant.states)[0] ??
          null;

        return {
          currentVariantId: id,
          currentStateId: nextStateId,
          renderingMode: getResolvedRenderingMode(variant),
          activeSnapGuides: [],
          pointMarquee: null,
          selectedIconGuideIndex: null,
          selection: { layerIds: [], pointIds: [] },
          transitionPreview: null,
        };
      });
    },

    setCurrentState(id) {
      editorStoreApi.setState({
        currentStateId: id,
        selectedIconGuideIndex: null,
        selection: { layerIds: [], pointIds: [] },
        activeSnapGuides: [],
        pointMarquee: null,
        transitionPreview: null,
      });
    },

    setStateTopology(iconId, stateId, topology) {
      editorStoreApi.setState((s) => {
        if (!s.project || !s.currentVariantId) return s;
        const icon = s.project.icons[iconId];
        const variant = icon?.variants[s.currentVariantId];
        const state = variant?.states[stateId];
        if (!icon || !variant || !state) return s;

        return {
          project: {
            ...s.project,
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...replaceVariantState(icon, s.currentVariantId, stateId, {
                  ...state,
                  topology,
                }),
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

    patchLayer(iconId, stateId, layerId, patch) {
      editorStoreApi.setState((s) => {
        if (!s.project || !s.currentVariantId) return s;
        const icon = s.project.icons[iconId];
        const variant = icon?.variants[s.currentVariantId];
        const state = variant?.states[stateId];
        const layer = state?.layers[layerId];
        if (!icon || !variant || !state || !layer) return s;

        const nextLayer = { ...layer, ...patch };
        const nextState = {
          ...state,
          layers: {
            ...state.layers,
            [layerId]: nextLayer,
          },
        };

        if (state.topology?.locked && patch.path) {
          const nextTopology = computeTopology(nextState);
          const compatibility = areTopologiesCompatible(state.topology, nextTopology);
          if (!compatibility.compatible) {
            throw new Error(`Topology is locked: ${compatibility.mismatches.join(' ')}`);
          }
        }

        return {
          project: {
            ...s.project,
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...replaceVariantState(icon, s.currentVariantId, stateId, {
                  ...nextState,
                }),
              },
            },
          },
        };
      });
    },

    renameLayer(iconId, stateId, oldLayerId, newLayerId) {
      editorStoreApi.setState((s) => {
        if (!s.project || !s.currentVariantId) return s;
        const icon = s.project.icons[iconId];
        const variant = icon?.variants[s.currentVariantId];
        const state = variant?.states[stateId];
        const layer = state?.layers[oldLayerId];
        if (!icon || !variant || !state || !layer) return s;
        if (oldLayerId === newLayerId) return s;
        if (state.layers[newLayerId]) return s;

        // Rebuild layers Record preserving insertion order
        const nextLayers: Record<string, Layer> = {};
        for (const [key, l] of Object.entries(state.layers)) {
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

        // Update transitions that reference the old layer ID in layerBindings
        let nextTransitions = icon.transitions;
        {
          const updatedTransitions: Record<string, typeof nextTransitions[string]> = {};
          let changed = false;
          for (const [tId, transition] of Object.entries(nextTransitions)) {
            const updatedBindings = transition.layerBindings.map((binding) => {
              const fromChanged = binding.fromLayerId === oldLayerId;
              const toChanged = binding.toLayerId === oldLayerId;
              if (fromChanged || toChanged) {
                return {
                  ...binding,
                  ...(fromChanged ? { fromLayerId: newLayerId } : {}),
                  ...(toChanged ? { toLayerId: newLayerId } : {}),
                };
              }
              return binding;
            });
            if (updatedBindings !== transition.layerBindings) {
              changed = true;
              updatedTransitions[tId] = { ...transition, layerBindings: updatedBindings };
            } else {
              updatedTransitions[tId] = transition;
            }
          }
          if (changed) nextTransitions = updatedTransitions;
        }

        // Update topology layerPairs if present
        const nextTopology = state.topology
          ? {
              ...state.topology,
              layerPairs: state.topology.layerPairs.map((pair) =>
                pair.layerId === oldLayerId
                  ? { ...pair, layerId: newLayerId }
                  : pair,
              ),
            }
          : state.topology;

        const nextState: State = {
          ...state,
          layers: nextLayers,
          topology: nextTopology,
        };

        return {
          selection: nextSelection,
          project: {
            ...s.project,
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...replaceVariantState(icon, s.currentVariantId, stateId, nextState),
                components: nextComponents,
                transitions: nextTransitions,
              },
            },
          },
        };
      });
    },

    setLayerVisibility(iconId, stateId, layerId, visible) {
      editorStoreApi.setState((s) => {
        if (!s.project || !s.currentVariantId) return s;
        const icon = s.project.icons[iconId];
        const variant = icon?.variants[s.currentVariantId];
        const state = variant?.states[stateId];
        const layer = state?.layers[layerId];
        if (!icon || !variant || !state || !layer) return s;

        return {
          project: {
            ...s.project,
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...replaceVariantState(icon, s.currentVariantId, stateId, {
                  ...state,
                  layers: {
                    ...state.layers,
                    [layerId]: { ...layer, visible },
                  },
                }),
              },
            },
          },
        };
      });
    },

    setClipMask(clipLayerId, targetLayerIds) {
      editorStoreApi.setState((s) => {
        if (!s.project || !s.currentIconId || !s.currentVariantId || !s.currentStateId) return s;
        const icon = s.project.icons[s.currentIconId];
        const variant = icon?.variants[s.currentVariantId];
        const state = variant?.states[s.currentStateId];
        const maskLayer = state?.layers[clipLayerId];
        if (!icon || !variant || !state || !maskLayer) return s;

        const nextTargetIds = Array.from(new Set(targetLayerIds)).filter(
          (layerId) => layerId !== clipLayerId && Boolean(state.layers[layerId]),
        );
        if (nextTargetIds.length === 0) return s;

        const previousMaskIds = new Set<string>();
        for (const targetLayerId of nextTargetIds) {
          const existingMaskId = state.layers[targetLayerId]?.clipPathLayerId;
          if (existingMaskId && existingMaskId !== clipLayerId) {
            previousMaskIds.add(existingMaskId);
          }
        }

        const nextLayers = { ...state.layers };
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
              [icon.id]: {
                ...replaceVariantState(icon, s.currentVariantId, state.id, {
                  ...state,
                  layers: nextLayers,
                }),
              },
            },
          },
        };
      });
    },

    releaseClipMask(layerId) {
      editorStoreApi.setState((s) => {
        if (!s.project || !s.currentIconId || !s.currentVariantId || !s.currentStateId) return s;
        const icon = s.project.icons[s.currentIconId];
        const variant = icon?.variants[s.currentVariantId];
        const state = variant?.states[s.currentStateId];
        const layer = state?.layers[layerId];
        if (!icon || !variant || !state || !layer) return s;

        const nextLayers = { ...state.layers };

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
              [icon.id]: {
                ...replaceVariantState(icon, s.currentVariantId, state.id, {
                  ...state,
                  layers: nextLayers,
                }),
              },
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

    startTransitionPreview(iconId, transition, variantId, progress = 0, crossIconContext) {
      const s = editorStoreApi.getState();
      if (!s.project) return;

      const clampedProgress = Math.max(0, Math.min(1, progress));
      let fromState: State | undefined;
      let toState: State | undefined;

      if (crossIconContext) {
        // Cross-icon preview: load from source icon/variant and target icon/variant
        const sourceIcon = s.project.icons[crossIconContext.sourceIconId];
        const targetIcon = s.project.icons[crossIconContext.targetIconId];
        const sourceVariant = sourceIcon?.variants[crossIconContext.sourceVariantId];
        const targetVariant = targetIcon?.variants[crossIconContext.targetVariantId];
        fromState = sourceVariant?.states[transition.from];
        toState = targetVariant?.states[transition.to];
      } else {
        // Intra-variant preview: both states come from the same variant
        const icon = s.project.icons[iconId];
        const variant = icon?.variants[variantId];
        fromState = variant?.states[transition.from];
        toState = variant?.states[transition.to];
      }

      if (!fromState || !toState) return;

      const resolved = resolveTransition(transition, fromState, toState, {
        crossIconContext,
      });

      editorStoreApi.setState({
        transitionPreview: {
          transitionId: transition.id,
          baseStateId: transition.from,
          targetStateId: transition.to,
          baseIconId: crossIconContext?.sourceIconId,
          baseVariantId: crossIconContext?.sourceVariantId,
          targetIconId: crossIconContext?.targetIconId,
          targetVariantId: crossIconContext?.targetVariantId,
          progress: clampedProgress,
          resolvedTransition: resolved,
          interpolatedValues: interpolateTransitionValues(resolved, clampedProgress),
        },
      });
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

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            guideMasters: Object.keys(nextGuideMasters).length > 0 ? nextGuideMasters : undefined,
          },
        };
      });
    },

    addGuideItem(masterId, item) {
      editorStoreApi.setState((s) => {
        const guideMaster = s.project?.guideMasters?.[masterId];
        if (!s.project || !guideMaster) return s;

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            guideMasters: {
              ...s.project.guideMasters,
              [masterId]: {
                ...guideMaster,
                items: [...guideMaster.items, item],
              },
            },
          },
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

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            guideMasters: {
              ...s.project.guideMasters,
              [masterId]: {
                ...guideMaster,
                items: guideMaster.items.filter((_, entryIndex) => entryIndex !== index),
              },
            },
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
            currentStateId: null,
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
        return {
          ...buildWorkspaceState(s.workspace, iconSetId, { previousState: s, keepTabs: true }),
          activeTabId: s.activeTabId,
          openTabs: s.openTabs,
        };
      });
    },

    updateIconSetSync(iconSetId, sync) {
      editorStoreApi.setState((s) => {
        const iconSet = s.workspace?.iconSets[iconSetId];
        if (!s.workspace || !iconSet) return s;
        const nextIconSet: IconSet = {
          ...iconSet,
          meta: { ...iconSet.meta, updatedAt: new Date().toISOString() },
          sync,
        };
        return {
          workspace: replaceWorkspaceIconSet(s.workspace, iconSetId, nextIconSet),
          project: s.activeIconSetId === iconSetId ? nextIconSet : s.project,
        };
      });
    },

    openIconTab(iconSetId, iconId, options) {
      const state = editorStoreApi.getState();
      const workspace = state.workspace;
      const iconSet = workspace?.iconSets[iconSetId];
      if (!iconSet?.icons[iconId]) return null;
      const variantId = getFirstVariantId(iconSet, iconId);
      const stateId = getFirstStateId(iconSet, iconId, variantId);
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
                stateId,
              },
            ];
        const shouldFocus = options?.focus !== false;
        return shouldFocus
          ? {
              ...buildWorkspaceState(s.workspace!, iconSetId, {
                previousState: s,
                keepTabs: true,
                requestedIconId: iconId,
              }),
              currentVariantId: variantId,
              currentStateId: stateId,
              openTabs: nextTabs,
              activeTabId: tabId,
            }
          : {
              openTabs: nextTabs,
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
          currentStateId: fallbackTab.stateId,
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
          currentStateId:
            tab.stateId ??
            getFirstStateId(
              s.workspace.iconSets[tab.iconSetId],
              tab.iconId,
              tab.variantId ?? getFirstVariantId(s.workspace.iconSets[tab.iconSetId], tab.iconId),
            ),
          openTabs: s.openTabs,
          activeTabId: tabId,
        };
      });
    },

    generateVariantMatrix(iconId, options) {
      const createdVariantIds: string[] = [];
      editorStoreApi.setState((s) => {
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
              const nextStates = cloneStateRecord(sourceVariant.states);
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
                defaultState: sourceVariant.defaultState,
                states: nextStates,
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
        if (!s.project || !s.currentIconId || !s.currentVariantId || !s.currentStateId) return s;
        const selectedLayerIds = Array.from(new Set(s.selection.layerIds));
        if (selectedLayerIds.length === 0) return s;

        const icon = s.project.icons[s.currentIconId];
        const variant = icon?.variants[s.currentVariantId];
        const state = variant?.states[s.currentStateId];
        if (!icon || !variant || !state) return s;

        const nextLayers = { ...state.layers };
        let removed = false;
        for (const layerId of selectedLayerIds) {
          if (!nextLayers[layerId]) continue;
          delete nextLayers[layerId];
          removed = true;
        }
        if (!removed) return s;

        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, updatedAt: new Date().toISOString() },
            icons: {
              ...s.project.icons,
              [icon.id]: {
                ...replaceVariantState(icon, variant.id, s.currentStateId, {
                  ...state,
                  layers: nextLayers,
                }),
              },
            },
          },
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

    pauseHistory() {
      temporalState.pause();
    },

    resumeHistory() {
      temporalState.resume();
    },

    commitHistory(label?: string) {
      temporalState.commit(label);
    },

    async applyBoolean(mode) {
      const snapshot = editorStoreApi.getState();
      const iconId = snapshot.currentIconId;
      const variantId = snapshot.currentVariantId;
      const stateId = snapshot.currentStateId;
      const selectedLayerIds = Array.from(new Set(snapshot.selection.layerIds));
      if (!snapshot.project || !iconId || !variantId || !stateId || selectedLayerIds.length < 2)
        return;

      const icon = snapshot.project.icons[iconId];
      const variant = icon?.variants[variantId];
      const state = variant?.states[stateId];
      if (!icon || !variant || !state) return;

      const selectedLayers = selectedLayerIds.map((layerId) => ({
        layerId,
        layer: state.layers[layerId],
      }));

      if (selectedLayers.some(({ layer }) => !layer?.path?.d)) return;

      let result = selectedLayers[0]!.layer.path!.d;
      for (const { layer } of selectedLayers.slice(1)) {
        result = await booleanOp(mode, result, layer.path!.d);
      }

      temporalState.pause();
      try {
        editorStoreApi.setState((s) => {
          if (!s.project) return s;
          const liveIcon = s.project.icons[iconId];
          const liveVariant = liveIcon?.variants[variantId];
          const liveState = liveVariant?.states[stateId];
          const primaryLayerId = selectedLayerIds[0]!;
          const primaryLayer = liveState?.layers[primaryLayerId];
          if (!liveIcon || !liveVariant || !liveState || !primaryLayer?.path) return s;

          const nextLayers = { ...liveState.layers };
          nextLayers[primaryLayerId] = {
            ...primaryLayer,
            path: {
              ...primaryLayer.path,
              d: result,
            },
          };

          for (const layerId of selectedLayerIds.slice(1)) {
            delete nextLayers[layerId];
          }

          return {
            project: {
              ...s.project,
              icons: {
                ...s.project.icons,
                [iconId]: {
                  ...replaceVariantState(liveIcon, variantId, stateId, {
                    ...liveState,
                    layers: nextLayers,
                  }),
                },
              },
            },
            selection: {
              layerIds: [primaryLayerId],
              pointIds: [],
            },
          };
        });
      } finally {
        temporalState.resume();
        temporalState.commit(`boolean:${mode}`);
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
