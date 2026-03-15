import type {
  Project,
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
} from '@/lib/schema/types';
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
import type { InterpolatedValues, ResolvedTransition } from '@/lib/runtime-core';

export type EditorState = {
  project: Project | null;
  isDirty: boolean;
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
};

export type TransitionPreview = {
  transitionId: string;
  baseStateId: string;
  targetStateId: string;
  progress: number;
  resolvedTransition: ResolvedTransition;
  interpolatedValues: InterpolatedValues;
};

export type EditorActions = {
  loadProject(project: ProjectInput, options?: LoadProjectOptions): void;
  newProject(): void;
  markSaved(updatedAt?: string): void;
  insertIcon(icon: Icon): void;
  addVariant(iconId: string, variant: VariantInput): void;
  removeVariant(iconId: string, variantId: string): void;
  patchVariant(iconId: string, variantId: string, patch: VariantPatch): void;
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
  generateVariantMatrix(
    iconId: string,
    options: { sizes: number[]; weights: SymbolWeight[]; scales: SymbolScale[]; sourceVariantId?: string },
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

export type VariantPatch = Partial<Pick<Variant, 'size' | 'viewBox' | 'renderingMode' | 'weight' | 'scale'>>;

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
};

type TemporalSnapshot = { project: Project | null; isDirty: boolean };

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
  project: null,
  isDirty: false,
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

function pushHistorySnapshot(project: Project | null, isDirty: boolean) {
  pastStates.push({ project, isDirty });
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
    project: snapshot.project,
    isDirty: snapshot.isDirty,
    renderingMode: getResolvedRenderingMode(variant),
    selection: { layerIds: [], pointIds: [] },
    activeSnapGuides: [],
    pointMarquee: null,
    pendingPenHandle: null,
    transitionPreview: null,
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

    futureStates.push({ project: currentState.project, isDirty: currentState.isDirty });
    applySnapshot(prev);
  },

  redo() {
    const next = futureStates.pop();
    if (!next) return;

    pastStates.push({ project: currentState.project, isDirty: currentState.isDirty });
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
    transactionBase = { project: currentState.project, isDirty: currentState.isDirty };
  },

  resume() {
    tracking = true;
  },

  discard() {
    if (transactionBase === undefined) return;
    currentState = {
      ...currentState,
      project: transactionBase.project,
      isDirty: transactionBase.isDirty,
    };
    tracking = true;
    transactionBase = undefined;
    emit();
  },

  commit(_label?: string) {
    if (transactionBase === undefined) return;
    if (
      transactionBase.project !== currentState.project ||
      transactionBase.isDirty !== currentState.isDirty
    ) {
      pushHistorySnapshot(transactionBase.project, transactionBase.isDirty);
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
    let next = replace
      ? (nextPatch as EditorStore)
      : ({ ...prev, ...nextPatch } as EditorStore);

    if (prev.project !== next.project && !hasExplicitDirty) {
      next = { ...next, isDirty: true };
    }

    if (prev.project !== next.project) {
      if (tracking) {
        pushHistorySnapshot(prev.project, prev.isDirty);
      } else if (transactionBase === undefined) {
        transactionBase = { project: prev.project, isDirty: prev.isDirty };
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
          const fallbackId = ensureUniqueGuideMasterId(
            guideSetId,
            nextGuideMasters,
            fallbackSize,
          );
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
            Object.values(nextGuideMasters).find(
              (master) => master.targetSize === variant.size,
            )?.id;

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

function getVariantStateById(
  project: Project | null,
  iconId: string | null | undefined,
  variantId: string | null | undefined,
  stateId: string | null | undefined,
): State | null {
  const variant = getVariantById(project, iconId, variantId);
  if (!variant || !stateId) return null;
  return variant.states[stateId] ?? null;
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

function getResolvedRenderingMode(
  variant: Pick<Variant, 'renderingMode'> | null | undefined,
): RenderingMode {
  return variant?.renderingMode ?? 'multicolor';
}

function createActions(): EditorActions {
  return {
    loadProject(project, options) {
      const { resetHistory = true, markDirty = false } = options ?? {};
      const migratedProject = migrateProjectForGuideMasters(project);
      const firstIconId = Object.keys(project.icons)[0] ?? null;
      const firstIcon = firstIconId ? migratedProject.icons[firstIconId] : null;
      const firstVariantId = firstIcon ? Object.keys(firstIcon.variants)[0] ?? null : null;
      const firstStateId = firstVariantId
        ? Object.keys(firstIcon?.variants[firstVariantId]?.states ?? {})[0] ?? null
        : null;

      editorStoreApi.setState({
        project: migratedProject,
        isDirty: markDirty,
        currentIconId: firstIconId,
        currentVariantId: firstVariantId,
        currentStateId: firstStateId,
        renderingMode: getResolvedRenderingMode(
          firstVariantId ? firstIcon?.variants[firstVariantId] : null,
        ),
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
        pendingPenHandle: null,
        transitionPreview: null,
        favorites: [],
        selectedTransitionId: null,
      });
      if (resetHistory) {
        resetHistoryForLoadedDocument();
      }
    },

    newProject() {
      const now = new Date().toISOString();
      const defaultGuideMaster = getDefaultGuideMaster(24);
      const project: Project = {
        version: '1.0',
        meta: { name: 'Untitled', createdAt: now, updatedAt: now },
        icons: {},
        guideMasters: {
          [defaultGuideMaster.id]: defaultGuideMaster,
        },
      };
      editorStoreApi.setState({ ...initialState, project, isDirty: false });
      resetHistoryForLoadedDocument();
    },

    markSaved(_updatedAt) {
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        return {
          isDirty: false,
        };
      });
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
          ? Object.keys(nextIcon.variants[nextVariantId]?.states ?? {})[0] ?? null
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
            ? Object.keys(nextVariants)[0] ?? null
            : s.currentVariantId;
        const fallbackVariant = fallbackVariantId ? nextVariants[fallbackVariantId] : null;
        const fallbackStateId =
          fallbackVariant && s.currentVariantId === variantId
            ? (s.currentStateId && fallbackVariant.states[s.currentStateId]
                ? s.currentStateId
                : fallbackVariant.defaultState) ?? Object.keys(fallbackVariant.states)[0] ?? null
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
          selection: s.currentVariantId === variantId ? { layerIds: [], pointIds: [] } : s.selection,
          activeSnapGuides: s.currentVariantId === variantId ? [] : s.activeSnapGuides,
          selectedIconGuideIndex: s.currentVariantId === variantId ? null : s.selectedIconGuideIndex,
          pointMarquee: s.currentVariantId === variantId ? null : s.pointMarquee,
          pointTransformLabel:
            s.currentVariantId === variantId ? null : s.pointTransformLabel,
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

    addTransition(iconId, transition) {
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        const icon = s.project.icons[iconId];
        if (!icon) return s;

        const nextTransitionId = ensureUniqueRecordId(
          transition.id,
          Object.keys(icon.transitions),
        );
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
            ? Object.keys(icon.variants[nextVariantId]?.states ?? {})[0] ?? null
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
        favorites: [],
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

        const nextId = ensureUniqueRecordId(
          master.id,
          Object.keys(s.project.guideMasters ?? {}),
        );
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
            guideMasters:
              Object.keys(nextGuideMasters).length > 0 ? nextGuideMasters : undefined,
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

        const toRemove = new Set(indexes.filter((index) => index >= 0 && index < icon.customGuides!.length));
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
              [collectionId]: { ...collection, id: collectionId, iconIds: Array.from(new Set(collection.iconIds)) },
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
        const existingNames = Object.values(existingVariants).map((variant) => variant.name ?? String(variant.size));

        for (const size of sizes) {
          for (const weight of weights) {
            for (const scale of scales) {
              const already = Object.values(existingVariants).find(
                (variant) => variant.size === size && variant.weight === weight && variant.scale === scale,
              );
              if (already) continue;

              const sourceVariant = pickClosestVariant(existingVariants, size, weight, scale, options.sourceVariantId) ?? Object.values(existingVariants)[0];
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
                  Object.values(s.project.guideMasters ?? {}).find((master) => master.targetSize === size)?.id,
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
      if (!snapshot.project || !iconId || !variantId || !stateId || selectedLayerIds.length < 2) return;

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
    const currentWeightIndex = variant.weight ? SYMBOL_WEIGHT_ORDER.indexOf(variant.weight) : SYMBOL_WEIGHT_ORDER.indexOf('regular');
    const currentScaleIndex = variant.scale ? SYMBOL_SCALE_ORDER.indexOf(variant.scale) : SYMBOL_SCALE_ORDER.indexOf('medium');

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

function hasClipMaskTargets(
  layers: Record<string, Layer>,
  clipLayerId: string,
): boolean {
  return Object.values(layers).some(
    (layer) => layer.id !== clipLayerId && layer.clipPathLayerId === clipLayerId,
  );
}
