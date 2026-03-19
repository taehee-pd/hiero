import type { CompiledIcon, CompiledRenderingMode, PackageManifest } from '@/lib/compiler-contracts';

export type GeneratedFile = {
  path: string;
  contents: string;
};

export type ReactIconGenerationResult = {
  files: GeneratedFile[];
  exports: Record<string, string>;
};

export function generateReactIconComponents(
  compiledIcons: CompiledIcon[],
  manifest: PackageManifest,
): ReactIconGenerationResult {
  const compiledById = new Map(compiledIcons.map((icon) => [icon.id, icon]));
  const files: GeneratedFile[] = [];

  const iconIds = Object.keys(manifest.icons).sort((a, b) => a.localeCompare(b));
  for (const iconId of iconIds) {
    const entry = manifest.icons[iconId]!;
    const compiled = compiledById.get(iconId);
    if (!compiled) continue;

    files.push(makeIconMetaFile(entry));

    for (const size of entry.supportedSizes) {
      const variant = findVariantBySize(compiled, size);
      if (!variant) continue;
      files.push(makeVariantDataFile(iconId, size, variant));
      files.push(makeSizedComponentFile(entry.componentName, iconId, size));
      files.push(makeSizeEntryFile(entry.componentName, size));
    }

    files.push(makeIconComponentFile(compiled, entry));
    files.push({
      path: `generated/icons/${entry.componentName}/index.ts`,
      contents: `export { default } from './${entry.componentName}';\n`,
    });
  }

  for (const [collectionId, collection] of Object.entries(manifest.collections)) {
    files.push(makeCollectionEntryFile(collectionId, collection.iconIds, manifest));
  }

  files.push(makeRootIndexFile(manifest));
  files.push(makeCollectionsIndexFile(manifest));

  return {
    files,
    exports: makePackageExports(manifest),
  };
}

function makeIconMetaFile(entry: PackageManifest['icons'][string]): GeneratedFile {
  return {
    path: `generated/icons/${entry.componentName}/meta.ts`,
    contents: `import type { IconComponentMeta } from '@/lib/runtime-sdk';

export const iconMeta: IconComponentMeta = ${serializeCode({
      id: entry.id,
      name: entry.name,
      componentName: entry.componentName,
      schema: 'https://coniva.dev/schemas/compiled-icon/1.0.0',
      version: entry.version,
      availableSizes: entry.supportedSizes,
      availableStates: entry.states,
      availableModes: entry.supportedModes,
    })};
`,
  };
}

function makeVariantDataFile(
  iconId: string,
  size: number,
  variant: CompiledIcon['variants'][string],
): GeneratedFile {
  return {
    path: `generated/icons/${toPascal(iconId)}/variants/${size}.ts`,
    contents: `export const variant${size} = ${serializeCode(variant)} as const;\n`,
  };
}

function makeSizedComponentFile(componentName: string, iconId: string, size: number): GeneratedFile {
  const pascalIconId = toPascal(iconId);
  return {
    path: `generated/icons/${componentName}/sizes/${size}.tsx`,
    contents: `import React, { forwardRef } from 'react';
import type { IconBaseProps } from '@/lib/runtime-sdk';
import { RuntimeIconRenderer } from '@/lib/runtime-sdk';
import { variant${size} } from '../../${pascalIconId}/variants/${size}';

type SizedProps = Omit<IconBaseProps, 'size'> & { size?: ${size} };

const iconData = {
  id: ${JSON.stringify(iconId)},
  name: ${JSON.stringify(componentName)},
  componentName: ${JSON.stringify(componentName)},
  $schema: 'https://coniva.dev/schemas/compiled-icon/1.0.0',
  meta: {
    category: '',
    tags: [],
    updatedAt: '',
    version: '1.0.0',
    contentHash: '',
  },
  variants: {
    '${size}': variant${size},
  },
  transitions: [],
  effects: [],
} as const;

const ${componentName}${size} = forwardRef<SVGSVGElement, SizedProps>(function ${componentName}${size}(props, ref) {
  return <RuntimeIconRenderer ref={ref} icon={iconData as any} size={${size}} {...props} />;
});

export default ${componentName}${size};
`,
  };
}

function makeSizeEntryFile(componentName: string, size: number): GeneratedFile {
  return {
    path: `generated/sizes/${size}/${componentName}.ts`,
    contents: `export { default } from '../../icons/${componentName}/sizes/${size}';\n`,
  };
}

function makeIconComponentFile(compiled: CompiledIcon, entry: PackageManifest['icons'][string]): GeneratedFile {
  const sizeUnion = unionOfNumbers(entry.supportedSizes);
  const stateUnion = unionOfStrings(entry.states);
  const modeUnion = unionOfModes(entry.supportedModes);
  const effectUnion = unionOfAnimateKinds(compiled.effects.map((effect) => effect.kind));

  const variantImports = entry.supportedSizes
    .map((size) => `import { variant${size} } from '../../${toPascal(entry.id)}/variants/${size}';`)
    .join('\n');

  const variantMap = `const variants = {\n${entry.supportedSizes
    .map((size) => `  '${size}': variant${size},`)
    .join('\n')}\n} as const;`;

  return {
    path: `generated/icons/${entry.componentName}/${entry.componentName}.tsx`,
    contents: `import React, { forwardRef } from 'react';
import type { IconBaseProps, IconComponentMeta } from '@/lib/runtime-sdk';
import { RuntimeIconRenderer } from '@/lib/runtime-sdk';
import { iconMeta } from './meta';
${variantImports}

type ${entry.componentName}Props = Omit<IconBaseProps, 'size' | 'state' | 'renderingMode' | 'animate'> & {
  size?: ${sizeUnion};
  state?: ${stateUnion};
  renderingMode?: ${modeUnion};
  animate?: ${effectUnion} | null;
};

${variantMap}

const iconData = {
  id: ${JSON.stringify(compiled.id)},
  name: ${JSON.stringify(compiled.name)},
  componentName: ${JSON.stringify(compiled.componentName)},
  $schema: ${JSON.stringify(compiled.$schema)},
  meta: {
    category: ${JSON.stringify(compiled.meta.category)},
    tags: ${serializeCode(compiled.meta.tags)},
    updatedAt: ${JSON.stringify(compiled.meta.updatedAt)},
    version: ${JSON.stringify(compiled.meta.version)},
    contentHash: ${JSON.stringify(compiled.meta.contentHash)},
  },
  variants,
  transitions: ${serializeCode(compiled.transitions)},
  effects: ${serializeCode(compiled.effects)},
} as const;

const ${entry.componentName} = forwardRef<SVGSVGElement, ${entry.componentName}Props>(function ${entry.componentName}(props, ref) {
  return <RuntimeIconRenderer ref={ref} icon={iconData as any} {...props} />;
});

(${entry.componentName} as typeof ${entry.componentName} & { __iconMeta: IconComponentMeta }).__iconMeta = iconMeta;

export default ${entry.componentName};
`,
  };
}

function makeCollectionEntryFile(
  collectionId: string,
  iconIds: string[],
  manifest: PackageManifest,
): GeneratedFile {
  const exports = iconIds
    .map((iconId) => manifest.icons[iconId])
    .filter(Boolean)
    .map(
      (icon) =>
        `export { default as ${icon!.componentName} } from '../icons/${icon!.componentName}';`,
    )
    .join('\n');

  return {
    path: `generated/collections/${collectionId}.ts`,
    contents: `${exports}\n`,
  };
}

function makeRootIndexFile(manifest: PackageManifest): GeneratedFile {
  const lines = Object.values(manifest.icons)
    .sort((a, b) => a.componentName.localeCompare(b.componentName))
    .map(
      (icon) =>
        `export { default as ${icon.componentName} } from './icons/${icon.componentName}';`,
    );

  return {
    path: 'generated/index.ts',
    contents: `${lines.join('\n')}\n`,
  };
}

function makeCollectionsIndexFile(manifest: PackageManifest): GeneratedFile {
  const lines = Object.keys(manifest.collections)
    .sort((a, b) => a.localeCompare(b))
    .map((collectionId) => `export * as ${toPascal(collectionId)} from './${collectionId}';`);

  return {
    path: 'generated/collections/index.ts',
    contents: `${lines.join('\n')}\n`,
  };
}

function makePackageExports(manifest: PackageManifest): Record<string, string> {
  const exports: Record<string, string> = {
    '.': './generated/index.ts',
    './collections': './generated/collections/index.ts',
  };

  for (const icon of Object.values(manifest.icons)) {
    exports[`./icons/${icon.componentName}`] =
      `./generated/icons/${icon.componentName}/index.ts`;
    for (const size of icon.supportedSizes) {
      exports[`./sizes/${size}/${icon.componentName}`] =
        `./generated/sizes/${size}/${icon.componentName}.ts`;
    }
  }

  for (const collectionId of Object.keys(manifest.collections)) {
    exports[`./collections/${collectionId}`] = `./generated/collections/${collectionId}.ts`;
  }

  return Object.fromEntries(
    Object.entries(exports).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function findVariantBySize(
  compiled: CompiledIcon,
  size: number,
): CompiledIcon['variants'][string] | undefined {
  return Object.values(compiled.variants).find((variant) => variant.size === size);
}

function unionOfNumbers(values: number[]): string {
  return values.sort((a, b) => a - b).join(' | ');
}

function unionOfStrings(values: string[]): string {
  return values.map((value) => JSON.stringify(value)).join(' | ');
}

function unionOfModes(values: CompiledRenderingMode[]): string {
  return values.map((value) => JSON.stringify(value)).join(' | ');
}

function unionOfAnimateKinds(values: string[]): string {
  const unique = [...new Set(values)].sort((a, b) => a.localeCompare(b));
  if (unique.length === 0) {
    return 'never';
  }
  return unique.map((value) => JSON.stringify(value)).join(' | ');
}

function toPascal(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('');
}

function serializeCode(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
