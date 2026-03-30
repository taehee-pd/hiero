import type { Project, Icon, RuntimeTransitionIntent, TopologyContract, Workspace } from './types';

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

export function isProject(val: unknown): val is Project {
  if (!isObject(val)) return false;
  if (val.version !== '1.0') return false;
  if (!isObject(val.meta)) return false;
  if (typeof (val.meta as Record<string, unknown>).name !== 'string') return false;
  if (!isObject(val.icons)) return false;
  for (const icon of Object.values(val.icons as Record<string, unknown>)) {
    if (!isIcon(icon)) return false;
  }
  return true;
}

export function isWorkspace(val: unknown): val is Workspace {
  if (!isObject(val)) return false;
  if (val.version !== '2.0') return false;
  if (!isObject(val.meta)) return false;
  if (typeof (val.meta as Record<string, unknown>).name !== 'string') return false;
  if (!isObject(val.iconSets)) return false;
  for (const iconSet of Object.values(val.iconSets as Record<string, unknown>)) {
    if (!isProject(iconSet)) return false;
  }
  const activeIconSetId = (val as Record<string, unknown>).activeIconSetId;
  if (activeIconSetId !== undefined && typeof activeIconSetId !== 'string') return false;
  return true;
}

export function isIcon(val: unknown): val is Icon {
  if (!isObject(val)) return false;
  if (typeof val.id !== 'string') return false;
  if (typeof val.name !== 'string') return false;
  if (!isObject(val.variants)) return false;
  return true;
}

export function isTransition(val: unknown): val is RuntimeTransitionIntent {
  if (!isObject(val)) return false;
  if (typeof val.id !== 'string') return false;
  if (typeof val.fromIconId !== 'string') return false;
  if (typeof val.toIconId !== 'string') return false;
  if (typeof val.fromVariantId !== 'string') return false;
  if (typeof val.toVariantId !== 'string') return false;
  const validStrategies = ['strictMorph', 'bestGuessMorph', 'lineAnimation', 'replace'];
  if (!validStrategies.includes(val.strategy as string)) return false;
  if (typeof val.durationMs !== 'number') return false;
  return true;
}

export function isTopologyContract(val: unknown): val is TopologyContract {
  if (!isObject(val)) return false;
  if (typeof val.locked !== 'boolean') return false;
  if (!Array.isArray(val.layerPairs)) return false;
  for (const pair of val.layerPairs) {
    if (!isObject(pair)) return false;
    if (typeof (pair as Record<string, unknown>).layerId !== 'string') return false;
    if (typeof (pair as Record<string, unknown>).subpathCount !== 'number') return false;
  }
  return true;
}
