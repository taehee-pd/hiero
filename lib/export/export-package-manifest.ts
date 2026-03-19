import type {
  CollectionEntry,
  CompiledIcon,
  CompiledRenderingMode,
  IconEntry,
  PackageManifest,
} from '@/lib/compiler-contracts';
import {
  PACKAGE_MANIFEST_SCHEMA_URI,
  isPackageManifest,
} from '@/lib/compiler-contracts';

type CompiledIconOutput = {
  path: string;
  compiled: CompiledIcon;
};

type ManifestCollectionResolver = () => Record<string, CollectionEntry>;

export type PackageManifestGeneratorOptions = {
  package: {
    name: string;
    version: string;
    builtAt: string;
    gitSha?: string;
    gitBranch?: string;
  };
  collections?: Record<string, CollectionEntry>;
  resolveCollections?: ManifestCollectionResolver;
};

const RENDERING_MODE_ORDER: CompiledRenderingMode[] = [
  'monochrome',
  'hierarchical',
  'palette',
  'multicolor',
];

export function generatePackageManifest(
  compiledIcons: CompiledIconOutput[],
  options: PackageManifestGeneratorOptions,
): PackageManifest {
  const schemaVersions = new Set(
    compiledIcons.map((entry) => getCompiledIconSchemaVersion(entry.compiled.$schema)),
  );

  if (schemaVersions.size > 1) {
    throw new Error(
      `Compiled icon schema version mismatch: ${[...schemaVersions]
        .sort((a, b) => a.localeCompare(b))
        .join(', ')}`,
    );
  }

  const iconSchemaVersion = [...schemaVersions][0] ?? '1.0.0';

  const sortedEntries = [...compiledIcons].sort((left, right) =>
    left.compiled.id.localeCompare(right.compiled.id),
  );

  const icons = sortedEntries.reduce<Record<string, IconEntry>>((acc, entry) => {
    acc[entry.compiled.id] = toIconEntry(entry.compiled, entry.path);
    return acc;
  }, {});

  const collections = resolveCollections(options);

  const manifest: PackageManifest = {
    $schema: PACKAGE_MANIFEST_SCHEMA_URI,
    package: {
      name: options.package.name,
      version: options.package.version,
      builtAt: options.package.builtAt,
      iconSchemaVersion,
      iconCount: compiledIcons.length,
      gitSha: options.package.gitSha,
      gitBranch: options.package.gitBranch,
    },
    icons,
    collections,
  };

  validatePackageManifestOrThrow(manifest);
  return manifest;
}

export function generatePackageManifestFile(
  compiledIcons: CompiledIconOutput[],
  options: PackageManifestGeneratorOptions,
): { path: 'icons.manifest.json'; contents: string; manifest: PackageManifest } {
  const manifest = generatePackageManifest(compiledIcons, options);
  return {
    path: 'icons.manifest.json',
    contents: serializePackageManifestJson(manifest),
    manifest,
  };
}

export function validatePackageManifestOrThrow(
  value: unknown,
): asserts value is PackageManifest {
  if (!isPackageManifest(value)) {
    throw new Error('Malformed PackageManifest payload.');
  }
}

export function serializePackageManifestJson(value: unknown): string {
  return `${JSON.stringify(sortJsonValue(value), null, 2)}\n`;
}

function toIconEntry(compiled: CompiledIcon, compiledPath: string): IconEntry {
  const sizes = new Set<number>();
  const states = new Set<string>(['default']);
  const modes = new Set<CompiledRenderingMode>();

  for (const variant of Object.values(compiled.variants)) {
    sizes.add(variant.size);

    for (const [stateId, state] of Object.entries(variant.states)) {
      states.add(stateId);
      for (const mode of Object.keys(state.modes)) {
        if (RENDERING_MODE_ORDER.includes(mode as CompiledRenderingMode)) {
          modes.add(mode as CompiledRenderingMode);
        }
      }
    }
  }

  const hasMorphTransition = compiled.transitions.some(
    (transition) =>
      transition.strategy === 'strictMorph' ||
      transition.strategy === 'bestGuessMorph' ||
      transition.bindings.some((binding) => binding.morph !== undefined),
  );

  return {
    id: compiled.id,
    name: compiled.name,
    componentName: compiled.componentName,
    category: compiled.meta.category,
    tags: [...compiled.meta.tags].sort((a, b) => a.localeCompare(b)),
    version: compiled.meta.version,
    updatedAt: compiled.meta.updatedAt,
    contentHash: compiled.meta.contentHash,
    supportedSizes: [...sizes].sort((a, b) => a - b),
    supportedModes: RENDERING_MODE_ORDER.filter((mode) => modes.has(mode)),
    states: [
      'default',
      ...[...states].filter((stateId) => stateId !== 'default').sort((a, b) => a.localeCompare(b)),
    ],
    hasAnimation: compiled.transitions.length > 0 || compiled.effects.length > 0,
    hasMorphTransition,
    compiledPath: toRelativePackagePath(compiledPath),
  };
}

function toRelativePackagePath(path: string): string {
  return path.replace(/^\.\//, '').replace(/^\//, '');
}

function resolveCollections(
  options: PackageManifestGeneratorOptions,
): Record<string, CollectionEntry> {
  if (options.resolveCollections) {
    return options.resolveCollections();
  }

  return options.collections ?? {};
}

function getCompiledIconSchemaVersion(schemaUri: string): string {
  const match = schemaUri.match(/^https:\/\/(?:coniva|icophone)\.dev\/schemas\/compiled-icon\/([^/]+)$/);
  if (!match) {
    throw new Error(`Unexpected compiled icon schema URI: ${schemaUri}`);
  }

  return match[1]!;
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortJsonValue(entry)] as const),
    );
  }

  return value;
}
