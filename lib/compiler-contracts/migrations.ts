/**
 * Schema migration registry for compiled icons.
 *
 * Enables forward-compatible readers: when a runtime encounters a compiled
 * icon with a different schema version, the registry resolves and chains
 * migration functions to bring it up to the current version.
 */

import { COMPILED_ICON_SCHEMA_URI } from './types';
import type { CompiledIconMigrationHook } from '../runtime-sdk/primitives';

/** A single migration step that transforms a payload in-place or returns a new one. */
export type MigrationFn = (payload: unknown) => unknown;

/** Registry that stores, resolves, and chains schema migration steps. */
export type MigrationRegistry = {
  /** Register a migration step from one schema URI to another. */
  register(from: string, to: string, fn: MigrationFn): void;
  /** Resolve a single direct migration step (returns null if not registered). */
  resolve(from: string, to: string): MigrationFn | null;
  /** Build a chained migration function from `from` to `currentSchemaUri`. Returns null if no path exists. */
  chain(from: string): MigrationFn | null;
  /** The target schema URI that `chain()` migrates towards. */
  readonly currentSchemaUri: string;
};

/**
 * Create a new migration registry targeting `COMPILED_ICON_SCHEMA_URI`.
 *
 * Register step-by-step migrations with `register()`, then call `chain()`
 * to produce a single function that walks from an older schema to the current one.
 */
export function createMigrationRegistry(): MigrationRegistry {
  // Map<fromUri, Map<toUri, MigrationFn>>
  const steps = new Map<string, Map<string, MigrationFn>>();

  function register(from: string, to: string, fn: MigrationFn): void {
    let targets = steps.get(from);
    if (!targets) {
      targets = new Map();
      steps.set(from, targets);
    }
    targets.set(to, fn);
  }

  function resolve(from: string, to: string): MigrationFn | null {
    return steps.get(from)?.get(to) ?? null;
  }

  function chain(from: string): MigrationFn | null {
    if (from === COMPILED_ICON_SCHEMA_URI) {
      return (payload: unknown) => payload;
    }

    // BFS to find shortest path from `from` to `currentSchemaUri`
    const visited = new Set<string>();
    const queue: Array<{ uri: string; path: string[] }> = [{ uri: from, path: [from] }];
    visited.add(from);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const targets = steps.get(current.uri);
      if (!targets) continue;

      for (const [targetUri] of targets) {
        if (visited.has(targetUri)) continue;
        const newPath = [...current.path, targetUri];

        if (targetUri === COMPILED_ICON_SCHEMA_URI) {
          // Build the composed migration function from the discovered path
          const fns: MigrationFn[] = [];
          for (let i = 0; i < newPath.length - 1; i++) {
            const stepFn = resolve(newPath[i]!, newPath[i + 1]!);
            if (!stepFn) return null; // should not happen given BFS found the path
            fns.push(stepFn);
          }
          return (payload: unknown) =>
            fns.reduce<unknown>((acc, fn) => fn(acc), payload);
        }

        visited.add(targetUri);
        queue.push({ uri: targetUri, path: newPath });
      }
    }

    return null;
  }

  return {
    register,
    resolve,
    chain,
    get currentSchemaUri() {
      return COMPILED_ICON_SCHEMA_URI;
    },
  };
}

/**
 * Create a `CompiledIconMigrationHook` backed by the given registry.
 *
 * The returned hook is suitable for passing to `parseCompiledIconJson`.
 * It will throw a descriptive error when no migration path exists.
 */
export function createMigrationHook(
  registry: MigrationRegistry,
): CompiledIconMigrationHook {
  return (payload: unknown, schemaUri: string): unknown => {
    const migrate = registry.chain(schemaUri);
    if (!migrate) {
      throw new Error(
        `No migration path from schema "${schemaUri}" to current schema "${registry.currentSchemaUri}".`,
      );
    }
    return migrate(payload);
  };
}

/**
 * Detect the schema version URI from a compiled icon payload.
 *
 * Returns the `$schema` string if present, or `null` for non-object /
 * missing-schema payloads.
 */
export function detectSchemaVersion(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return null;
  }
  const schema = (payload as Record<string, unknown>).$schema;
  if (typeof schema === 'string' && schema.length > 0) {
    return schema;
  }
  return null;
}
