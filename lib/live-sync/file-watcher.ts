/**
 * Source directory file watcher — Lane 1 change detection.
 *
 * Watches sourceDir for changes to .json and .svg files (the canonical source
 * format). Debounces rapid consecutive changes before firing the callback.
 *
 * Uses Node.js built-in fs.watch with recursive option (Node 18+ on macOS
 * and Windows; Linux requires inotify support). On unsupported platforms the
 * watcher silently falls back to a no-op — the user can still trigger manual
 * rebuilds via the API.
 *
 * Node.js only — not imported by browser code.
 */

import { watch, type FSWatcher } from 'node:fs';
import path from 'node:path';

export type WatchCallback = (changedPath: string) => void;

export type FileWatcherHandle = {
  /** Stop watching. Safe to call multiple times. */
  close(): void;
  /** Whether the watcher is currently active. */
  readonly active: boolean;
};

const RELEVANT_EXTENSIONS = new Set(['.json', '.svg']);
const DEFAULT_DEBOUNCE_MS = 100;

/**
 * Watch `sourceDir` for icon source file changes.
 *
 * @param sourceDir   Absolute path to the directory to watch.
 * @param onChanged   Callback fired with the absolute path of the changed file.
 * @param debounceMs  Milliseconds to wait before firing after a burst of changes.
 *                    Defaults to 100ms.
 */
export function watchSourceDir(
  sourceDir: string,
  onChanged: WatchCallback,
  debounceMs: number = DEFAULT_DEBOUNCE_MS,
): FileWatcherHandle {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingChangedPath = '';
  let watcher: FSWatcher | null = null;
  let isActive = false;

  const fire = (filePath: string) => {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    pendingChangedPath = filePath;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      onChanged(pendingChangedPath);
    }, debounceMs);
  };

  try {
    watcher = watch(
      sourceDir,
      { recursive: true, persistent: false },
      (_event, filename) => {
        if (!filename) return;
        const ext = path.extname(filename).toLowerCase();
        if (!RELEVANT_EXTENSIONS.has(ext)) return;
        fire(path.join(sourceDir, filename));
      },
    );

    watcher.on('error', () => {
      // Watcher errors (e.g. ENOENT if sourceDir is deleted) — close quietly.
      handle.close();
    });

    isActive = true;
  } catch {
    // fs.watch may fail on some platforms or if sourceDir doesn't exist.
    // Proceed without watching — incremental rebuilds can still be triggered
    // via the HTTP API.
  }

  const handle: FileWatcherHandle = {
    close() {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (watcher) {
        watcher.close();
        watcher = null;
      }
      isActive = false;
    },

    get active() {
      return isActive;
    },
  };

  return handle;
}
