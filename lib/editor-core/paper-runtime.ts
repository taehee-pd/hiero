export interface PaperPoint {
  x: number;
  y: number;
}

export interface PaperSize {
  width: number;
  height: number;
}

export interface PaperRectangle extends PaperSize {
  x: number;
  y: number;
  clone(): PaperRectangle;
  expand(horizontal: number, vertical?: number): PaperRectangle;
  intersects(other: PaperRectangle): boolean;
}

export type PaperBounds = PaperRectangle;

export interface PaperColor {
  readonly __paperColorBrand?: never;
}

export interface PaperRemovable {
  remove(): void;
}

export interface PaperTransformable extends PaperRemovable {
  fillColor: unknown;
  strokeColor: unknown;
  strokeWidth?: number;
  dashArray?: number[];
  translate(point: PaperPoint): void;
  rotate(angle: number, center?: PaperPoint): void;
  scale(scaleX: number, scaleY?: number, center?: PaperPoint): void;
  sendToBack?(): void;
}

export interface PaperCompoundPath extends PaperTransformable {
  bounds: PaperBounds;
  strokeBounds: PaperBounds;
  pathData?: string;
  getPathData?(): string;
  [key: string]: unknown;
}

export interface PaperPointText extends PaperTransformable {
  bounds: PaperBounds;
  bringToFront(): void;
}

export interface PaperScopeInstance {
  setup(target: HTMLCanvasElement | PaperSize): void;
  activate(): void;
  project: {
    clear(): void;
    remove?: () => void;
  };
  view: {
    viewSize: PaperSize;
    update(): void;
    remove?: () => void;
  };
  Point: new (x: number, y: number) => PaperPoint;
  Size: new (width: number, height: number) => PaperSize;
  Rectangle: new (...args: unknown[]) => PaperRectangle;
  Color: new (...args: unknown[]) => PaperColor;
  Path: {
    Line: new (...args: unknown[]) => PaperTransformable;
    Rectangle: new (...args: unknown[]) => PaperTransformable;
    Ellipse: new (...args: unknown[]) => PaperTransformable;
    Circle: new (...args: unknown[]) => PaperTransformable;
  };
  CompoundPath: new (...args: unknown[]) => PaperCompoundPath;
  PointText: new (...args: unknown[]) => PaperPointText;
  remove?: () => void;
}

export type PaperGlobal = {
  PaperScope: new () => PaperScopeInstance;
  Size: new (width: number, height: number) => PaperSize;
};

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
