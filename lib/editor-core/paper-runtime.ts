export type PaperGlobal = any;

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
