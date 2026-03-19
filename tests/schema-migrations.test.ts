import { describe, expect, test } from 'bun:test';

import {
  createMigrationHook,
  createMigrationRegistry,
  detectSchemaVersion,
} from '../lib/compiler-contracts/migrations';
import { COMPILED_ICON_SCHEMA_URI } from '../lib/compiler-contracts/types';
import { parseCompiledIconJson } from '../lib/runtime-sdk/primitives';
import compiledIconFixture from './fixtures/compiler-contracts/compiled-icon.json';

// ---------------------------------------------------------------------------
// detectSchemaVersion
// ---------------------------------------------------------------------------

describe('detectSchemaVersion', () => {
  test('extracts $schema from a valid object', () => {
    const version = detectSchemaVersion({
      $schema: 'https://coniva.dev/schemas/compiled-icon/0.9.0',
    });
    expect(version).toBe('https://coniva.dev/schemas/compiled-icon/0.9.0');
  });

  test('returns null for a missing $schema field', () => {
    expect(detectSchemaVersion({ name: 'test' })).toBeNull();
  });

  test('returns null for a non-string $schema', () => {
    expect(detectSchemaVersion({ $schema: 42 })).toBeNull();
  });

  test('returns null for an empty string $schema', () => {
    expect(detectSchemaVersion({ $schema: '' })).toBeNull();
  });

  test('returns null for non-object payloads', () => {
    expect(detectSchemaVersion(null)).toBeNull();
    expect(detectSchemaVersion(undefined)).toBeNull();
    expect(detectSchemaVersion('string')).toBeNull();
    expect(detectSchemaVersion(123)).toBeNull();
    expect(detectSchemaVersion([])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Single-step migration
// ---------------------------------------------------------------------------

describe('single-step migration', () => {
  const V090 = 'https://coniva.dev/schemas/compiled-icon/0.9.0';

  test('register and resolve a single migration step', () => {
    const registry = createMigrationRegistry();

    const migrateFn = (payload: unknown) => {
      const obj = payload as Record<string, unknown>;
      return { ...obj, $schema: COMPILED_ICON_SCHEMA_URI, migrated: true };
    };

    registry.register(V090, COMPILED_ICON_SCHEMA_URI, migrateFn);

    const resolved = registry.resolve(V090, COMPILED_ICON_SCHEMA_URI);
    expect(resolved).toBe(migrateFn);
  });

  test('resolve returns null for an unregistered step', () => {
    const registry = createMigrationRegistry();
    expect(
      registry.resolve(V090, COMPILED_ICON_SCHEMA_URI),
    ).toBeNull();
  });

  test('chain applies a single-step migration correctly', () => {
    const registry = createMigrationRegistry();

    registry.register(V090, COMPILED_ICON_SCHEMA_URI, (payload) => {
      const obj = payload as Record<string, unknown>;
      return { ...obj, $schema: COMPILED_ICON_SCHEMA_URI };
    });

    const migrate = registry.chain(V090);
    expect(migrate).not.toBeNull();

    const result = migrate!({ $schema: V090, value: 1 }) as Record<string, unknown>;
    expect(result.$schema).toBe(COMPILED_ICON_SCHEMA_URI);
    expect(result.value).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Multi-step chain migration (0.8.0 -> 0.9.0 -> 1.0.0)
// ---------------------------------------------------------------------------

describe('multi-step chain migration', () => {
  const V080 = 'https://coniva.dev/schemas/compiled-icon/0.8.0';
  const V090 = 'https://coniva.dev/schemas/compiled-icon/0.9.0';

  test('chains two migration steps (0.8.0 -> 0.9.0 -> 1.0.0)', () => {
    const registry = createMigrationRegistry();

    // Step 1: 0.8.0 -> 0.9.0 adds a "legacy" field
    registry.register(V080, V090, (payload) => {
      const obj = payload as Record<string, unknown>;
      return { ...obj, $schema: V090, legacy: true };
    });

    // Step 2: 0.9.0 -> 1.0.0 removes "legacy" and stamps final schema
    registry.register(V090, COMPILED_ICON_SCHEMA_URI, (payload) => {
      const { legacy: _removed, ...rest } = payload as Record<string, unknown>;
      return { ...rest, $schema: COMPILED_ICON_SCHEMA_URI };
    });

    const migrate = registry.chain(V080);
    expect(migrate).not.toBeNull();

    const result = migrate!({ $schema: V080, data: 'hello' }) as Record<string, unknown>;
    expect(result.$schema).toBe(COMPILED_ICON_SCHEMA_URI);
    expect(result.data).toBe('hello');
    // The intermediate "legacy" field should have been added then removed
    expect(result).not.toHaveProperty('legacy');
  });

  test('chain returns identity function when from equals currentSchemaUri', () => {
    const registry = createMigrationRegistry();
    const migrate = registry.chain(COMPILED_ICON_SCHEMA_URI);
    expect(migrate).not.toBeNull();

    const input = { $schema: COMPILED_ICON_SCHEMA_URI, value: 42 };
    expect(migrate!(input)).toBe(input); // same reference
  });

  test('chain returns null when no migration path exists', () => {
    const registry = createMigrationRegistry();
    const migrate = registry.chain('https://coniva.dev/schemas/compiled-icon/0.1.0');
    expect(migrate).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Unknown schema throws meaningful error
// ---------------------------------------------------------------------------

describe('unknown schema version error handling', () => {
  test('createMigrationHook throws for unknown schema version', () => {
    const registry = createMigrationRegistry();
    const hook = createMigrationHook(registry);

    const unknownUri = 'https://coniva.dev/schemas/compiled-icon/0.5.0';

    expect(() => hook({}, unknownUri)).toThrow(
      `No migration path from schema "${unknownUri}" to current schema "${COMPILED_ICON_SCHEMA_URI}".`,
    );
  });
});

// ---------------------------------------------------------------------------
// createMigrationHook integration with parseCompiledIconJson
// ---------------------------------------------------------------------------

describe('createMigrationHook integration', () => {
  const V090 = 'https://coniva.dev/schemas/compiled-icon/0.9.0';

  test('hook created from registry migrates payload in parseCompiledIconJson', () => {
    const registry = createMigrationRegistry();

    registry.register(V090, COMPILED_ICON_SCHEMA_URI, (payload) => {
      const obj = structuredClone(payload) as Record<string, unknown>;
      obj.$schema = COMPILED_ICON_SCHEMA_URI;
      return obj;
    });

    const hook = createMigrationHook(registry);

    // Clone the fixture and stamp it with the old schema
    const oldPayload = structuredClone(compiledIconFixture) as unknown as Record<string, unknown>;
    oldPayload.$schema = V090;

    const { icon, meta } = parseCompiledIconJson(oldPayload, {
      migrationHook: hook,
    });

    expect(icon.$schema).toBe(COMPILED_ICON_SCHEMA_URI);
    expect(meta.id).toBe(icon.id);
    expect(meta.schema).toBe(COMPILED_ICON_SCHEMA_URI);
  });

  test('hook throws when registry has no path for the encountered schema', () => {
    const registry = createMigrationRegistry();
    const hook = createMigrationHook(registry);

    const payload = structuredClone(compiledIconFixture) as unknown as Record<string, unknown>;
    payload.$schema = 'https://coniva.dev/schemas/compiled-icon/0.1.0';

    expect(() => parseCompiledIconJson(payload, { migrationHook: hook })).toThrow(
      'No migration path',
    );
  });

  test('currentSchemaUri property reflects the compiled icon schema constant', () => {
    const registry = createMigrationRegistry();
    expect(registry.currentSchemaUri).toBe(COMPILED_ICON_SCHEMA_URI);
  });
});
