import { loadPaperGlobal, type PaperItem, type PaperScope, type PaperCompoundPath } from './paper-runtime';

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

function extractPathData(item: Pick<PaperItem, 'pathData' | 'getPathData'> | null): string {
  const pathData =
    typeof item?.pathData === 'string'
      ? item.pathData
      : typeof item?.getPathData === 'function'
        ? item.getPathData()
        : '';

  return normalizePathData(pathData);
}

function cleanupScope(scope: PaperScope | null, ...items: (PaperItem | null)[]) {
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

  let left: PaperCompoundPath | null = null;
  let right: PaperCompoundPath | null = null;
  let result: PaperItem | null = null;

  try {
    scope.activate();

    left = new scope.CompoundPath({
      pathData: normalizePathData(pathA),
      insert: false,
    });
    right = new scope.CompoundPath({
      pathData: normalizePathData(pathB),
      insert: false,
    });

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

    result = left[mode](right, { insert: false }) as PaperItem;

    return extractPathData(result);
  } finally {
    cleanupScope(scope, result, left, right);
  }
}
