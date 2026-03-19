/** Minimal typed surface of the Paper.js runtime used across the codebase. */
export interface PaperPoint {
  x: number;
  y: number;
}

export interface PaperSize {
  width: number;
  height: number;
}

export interface PaperRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
  clone(): PaperRectangle;
  intersects(rect: PaperRectangle): boolean;
  expand(hor: number, ver: number): PaperRectangle;
}

export interface PaperColor {
  _class: 'Color';
}

export interface PaperItem {
  pathData?: string;
  bounds: PaperRectangle;
  strokeBounds: PaperRectangle;
  fillColor: PaperColor | null;
  strokeColor: PaperColor | null;
  strokeWidth: number;
  dashArray?: number[];
  translate(delta: PaperPoint): void;
  rotate(angle: number, center: PaperPoint): void;
  scale(hor: number, ver: number, center: PaperPoint): void;
  remove(): void;
  sendToBack(): void;
  bringToFront(): void;
  getPathData?: () => string;
}

export interface PaperCompoundPath extends PaperItem {
  unite(path: PaperItem, options?: { insert?: boolean }): PaperItem;
  subtract(path: PaperItem, options?: { insert?: boolean }): PaperItem;
  intersect(path: PaperItem, options?: { insert?: boolean }): PaperItem;
  exclude(path: PaperItem, options?: { insert?: boolean }): PaperItem;
}

export interface PaperProject {
  clear(): void;
  remove(): void;
}

export interface PaperView {
  viewSize: PaperSize;
  update(): void;
  remove(): void;
}

export interface PaperScope {
  project: PaperProject;
  view: PaperView;
  activate(): void;
  setup(element: HTMLCanvasElement | PaperSize): void;
  remove(): void;
  Point: new (x: number, y: number) => PaperPoint;
  Size: new (width: number, height: number) => PaperSize;
  Color: new (value: string) => PaperColor;
  Rectangle: new (...args: unknown[]) => PaperRectangle;
  CompoundPath: new (arg: string | Record<string, unknown>) => PaperCompoundPath;
  PointText: new (options: Record<string, unknown>) => PaperItem;
  Path: {
    Line: new (from: PaperPoint, to: PaperPoint) => PaperItem;
    Rectangle: new (options: Record<string, unknown>) => PaperItem;
    Circle: new (options: Record<string, unknown>) => PaperItem;
    Ellipse: new (options: Record<string, unknown>) => PaperItem;
  };
}

export interface PaperGlobal {
  PaperScope: new () => PaperScope;
  Size: new (width: number, height: number) => PaperSize;
  Point: new (x: number, y: number) => PaperPoint;
  Color: new (value: string) => PaperColor;
  Rectangle: new (...args: unknown[]) => PaperRectangle;
  CompoundPath: new (arg: string | Record<string, unknown>) => PaperCompoundPath;
  Path: PaperScope['Path'];
  PointText: new (options: Record<string, unknown>) => PaperItem;
}

type PaperWindow = Window & { paper?: PaperGlobal };

const PAPER_SCRIPT_ID = 'paper-core-runtime';
const PAPER_SCRIPT_SRC = '/vendor/paper-core.min.js';

let paperLoadPromise: Promise<PaperGlobal> | null = null;

export function getPaperGlobal(): PaperGlobal | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as PaperWindow).paper ?? null;
}

export function loadPaperGlobal(): Promise<PaperGlobal> {
  const loaded = getPaperGlobal();
  if (loaded) return Promise.resolve(loaded);
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Paper.js runtime is only available in the browser.'));
  }
  if (paperLoadPromise) return paperLoadPromise;

  paperLoadPromise = new Promise<PaperGlobal>((resolve, reject) => {
    const onLoaded = () => {
      const runtime = getPaperGlobal();
      if (!runtime) {
        paperLoadPromise = null;
        reject(new Error('Paper.js runtime did not attach to window.'));
        return;
      }
      resolve(runtime);
    };

    const onError = () => {
      paperLoadPromise = null;
      reject(new Error('Failed to load Paper.js runtime script.'));
    };

    const existing = document.getElementById(PAPER_SCRIPT_ID) as
      | HTMLScriptElement
      | null;

    if (existing) {
      const runtime = getPaperGlobal();
      if (runtime) {
        resolve(runtime);
        return;
      }

      if (existing.dataset.paperStatus === 'error') {
        onError();
        return;
      }

      existing.addEventListener('load', onLoaded, { once: true });
      existing.addEventListener('error', onError, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = PAPER_SCRIPT_ID;
    script.src = PAPER_SCRIPT_SRC;
    script.async = true;
    script.dataset.paperStatus = 'loading';
    script.addEventListener(
      'load',
      () => {
        script.dataset.paperStatus = 'loaded';
        onLoaded();
      },
      { once: true },
    );
    script.addEventListener(
      'error',
      () => {
        script.dataset.paperStatus = 'error';
        onError();
      },
      { once: true },
    );
    document.head.appendChild(script);
  });

  return paperLoadPromise;
}
