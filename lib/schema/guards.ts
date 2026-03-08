import type { Project, Icon, Transition, TopologyContract } from './types';

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

export function isIcon(val: unknown): val is Icon {
  if (!isObject(val)) return false;
  if (typeof val.id !== 'string') return false;
  if (typeof val.name !== 'string') return false;
  if (!isObject(val.variants)) return false;
  if (!isObject(val.transitions)) return false;
  return true;
}

export function isTransition(val: unknown): val is Transition {
  if (!isObject(val)) return false;
  if (typeof val.id !== 'string') return false;
  if (typeof val.from !== 'string') return false;
  if (typeof val.to !== 'string') return false;
  const validStrategies = ['track', 'strictMorph', 'bestGuessMorph', 'replace'];
  if (!validStrategies.includes(val.strategy as string)) return false;
  if (typeof val.durationMs !== 'number') return false;
  if (!Array.isArray(val.layerBindings)) return false;
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
