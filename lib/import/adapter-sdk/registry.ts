/**
 * ExternalIconAdapterRegistry — singleton registry that manages adapter
 * lifecycle, lookup by id or input mode, and exposes adapter metadata for
 * the import UI.
 *
 * Design constraints:
 *   - Adapters register themselves; the registry never imports adapter modules.
 *   - Lookup is O(1) by id, O(n) by input mode (n = registered adapter count,
 *     expected to remain small).
 *   - The registry is stateless beyond the adapter map — no caching, no
 *     request tracking.
 *   - Future adapters (Heroicons, Phosphor, Material Symbols, internal
 *     packages) register through the same `register()` call with zero
 *     changes to this module.
 */

import type {
  ExternalIconAdapter,
  ExternalIconInputMode,
  ExternalIconSourceDescriptor,
} from './types';

// ---------------------------------------------------------------------------
// Registry interface
// ---------------------------------------------------------------------------

export interface ExternalIconAdapterRegistry {
  /**
   * Register an adapter.  Throws if the id is already taken — adapters must
   * have globally unique ids.
   */
  register(adapter: ExternalIconAdapter): void;

  /**
   * Remove a previously registered adapter.  No-op if the id is not found.
   */
  unregister(adapterId: string): void;

  /**
   * Resolve an adapter by its unique id.  Returns `undefined` if not found.
   */
  get(adapterId: string): ExternalIconAdapter | undefined;

  /**
   * Return all adapters that support a given input mode.
   * Useful for the UI: "which adapters can handle a pasted SVG string?"
   */
  getByInputMode(mode: ExternalIconInputMode): ExternalIconAdapter[];

  /**
   * Return all adapters for a high-level source type (library/raw/file/etc).
   */
  getBySourceType(sourceType: string): ExternalIconAdapter[];

  /**
   * Return descriptors for every registered adapter.
   * The UI uses this to render the source picker without holding adapter
   * references directly.
   */
  listDescriptors(): ExternalIconSourceDescriptor[];

  /**
   * Return all registered adapters.
   */
  listAll(): ExternalIconAdapter[];

  /**
   * Number of registered adapters.
   */
  readonly size: number;

  /**
   * Remove all registered adapters.  Primarily useful for test isolation.
   */
  clear(): void;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

class AdapterRegistry implements ExternalIconAdapterRegistry {
  private readonly adapters = new Map<string, ExternalIconAdapter>();

  register(adapter: ExternalIconAdapter): void {
    const { id, capabilities } = adapter.descriptor;

    if (!id || typeof id !== 'string') {
      throw new Error('Adapter descriptor.id must be a non-empty string');
    }
    if (this.adapters.has(id)) {
      throw new Error(
        `Adapter "${id}" is already registered. ` +
          'Each adapter must have a globally unique id.',
      );
    }
    if (!capabilities.inputModes.length) {
      throw new Error(
        `Adapter "${id}" declares no input modes. ` +
          'At least one input mode is required.',
      );
    }
    if (!capabilities.sourceType || typeof capabilities.sourceType !== 'string') {
      throw new Error(
        `Adapter "${id}" declares no sourceType. ` +
          'A sourceType string is required for source-based resolution.',
      );
    }
    if (capabilities.searchable && typeof adapter.search !== 'function') {
      throw new Error(
        `Adapter "${id}" declares searchable: true but does not implement search().`,
      );
    }

    this.adapters.set(id, adapter);
  }

  unregister(adapterId: string): void {
    this.adapters.delete(adapterId);
  }

  get(adapterId: string): ExternalIconAdapter | undefined {
    return this.adapters.get(adapterId);
  }

  getByInputMode(mode: ExternalIconInputMode): ExternalIconAdapter[] {
    const all = Array.from(this.adapters.values());
    return all.filter((a) => a.descriptor.capabilities.inputModes.includes(mode));
  }

  getBySourceType(sourceType: string): ExternalIconAdapter[] {
    const all = Array.from(this.adapters.values());
    return all.filter((a) => a.descriptor.capabilities.sourceType === sourceType);
  }

  listDescriptors(): ExternalIconSourceDescriptor[] {
    return Array.from(this.adapters.values()).map((a) => a.descriptor);
  }

  listAll(): ExternalIconAdapter[] {
    return Array.from(this.adapters.values());
  }

  get size(): number {
    return this.adapters.size;
  }

  clear(): void {
    this.adapters.clear();
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new isolated registry instance.  Use `adapterRegistry` for the
 * shared app-wide singleton; use `createAdapterRegistry()` in tests.
 */
export function createAdapterRegistry(): ExternalIconAdapterRegistry {
  return new AdapterRegistry();
}

/**
 * App-wide singleton registry.  Adapters register here at module init time
 * (e.g. in `lib/import/adapters/index.ts`).
 */
export const adapterRegistry: ExternalIconAdapterRegistry = createAdapterRegistry();
