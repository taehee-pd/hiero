import { loadPaperGlobal } from './paper-runtime';
import type {
  PaperCompoundPath,
  PaperRemovable,
  PaperScopeInstance,
} from './paper-runtime';

export type BooleanMode = 'unite' | 'subtract' | 'intersect' | 'exclude';

function normalizePathData(pathData: string): string {
  return pathData.trim().replace(/\s+/g, ' ');
}

function isEmptyPathData(pathData: string): boolean {
  return normalizePathData(pathData).length === 0;
}

function resolveEmptyInput(mode: BooleanMode, pathA: string, pathB: string): string {
  const left = isEmptyPathData(pathA);
  const right = isEmptyPathData(pathB);

  if (!left && !right) return '';
  if (left && right) return '';

  if (mode === 'intersect') return '';

  if (mode === 'unite' || mode === 'exclude') {
    return left ? normalizePathData(pathB) : normalizePathData(pathA);
  }

  return left ? '' : normalizePathData(pathA);
}

function resolveIdenticalInput(mode: BooleanMode, pathData: string): string {
  if (mode === 'subtract' || mode === 'exclude') return '';
  return pathData;
}

type PaperPathDataSource = {
  pathData?: string;
  getPathData?: () => string;
} | null | undefined;

type PaperBooleanCompoundPath = PaperCompoundPath & {
  [key in BooleanMode]: (
    other: PaperBooleanCompoundPath,
    options: { insert: boolean },
  ) => PaperBooleanCompoundPath;
};

function extractPathData(item: PaperPathDataSource): string {
  const pathData =
    typeof item?.pathData === 'string'
      ? item.pathData
      : typeof item?.getPathData === 'function'
        ? item.getPathData()
        : '';

  return normalizePathData(pathData);
}

function cleanupScope(
  scope: (Pick<PaperScopeInstance, 'project' | 'view'> & { remove?: () => void }) | null | undefined,
  ...items: Array<PaperRemovable | null | undefined>
) {
  for (const item of items) {
    if (item && typeof item.remove === 'function') {
      try {
        item.remove();
      } catch {
        // Ignore cleanup failures on detached Paper items.
      }
    }
  }

  try {
    scope?.project?.clear?.();
  } catch {
    // Ignore cleanup failures on torn-down projects.
  }

  try {
    scope?.project?.remove?.();
  } catch {
    // Ignore cleanup failures on torn-down projects.
  }

  try {
    scope?.view?.remove?.();
  } catch {
    // Ignore cleanup failures on torn-down views.
  }

  try {
    scope?.remove?.();
  } catch {
    // Ignore cleanup failures on torn-down scopes.
  }
}

export async function booleanOp(
  mode: BooleanMode,
  pathA: string,
  pathB: string,
): Promise<string> {
  if (isEmptyPathData(pathA) || isEmptyPathData(pathB)) {
    return resolveEmptyInput(mode, pathA, pathB);
  }

  const paperGlobal = await loadPaperGlobal();
  const scope = new paperGlobal.PaperScope();
  scope.setup(new paperGlobal.Size(1, 1));

  let left: PaperBooleanCompoundPath | null = null;
  let right: PaperBooleanCompoundPath | null = null;
  let result: PaperBooleanCompoundPath | null = null;

  try {
    scope.activate();

    left = new scope.CompoundPath({
      pathData: normalizePathData(pathA),
      insert: false,
    }) as PaperBooleanCompoundPath;
    right = new scope.CompoundPath({
      pathData: normalizePathData(pathB),
      insert: false,
    }) as PaperBooleanCompoundPath;

    const normalizedA = extractPathData(left);
    const normalizedB = extractPathData(right);
    if (!normalizedA || !normalizedB) {
      return resolveEmptyInput(mode, normalizedA, normalizedB);
    }

    if (normalizedA === normalizedB) {
      return resolveIdenticalInput(mode, normalizedA);
    }

    if (!left.bounds.intersects(right.bounds) && mode === 'intersect') {
      return '';
    }

    result = left[mode](right, { insert: false });

    return extractPathData(result);
  } finally {
    cleanupScope(scope, result, left, right);
  }
}
