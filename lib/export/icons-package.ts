import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { isCompiledIcon, isPackageManifest, type PackageManifest } from '@/lib/compiler-contracts';
import { runCompileCommand } from '@/lib/export/compile-pipeline';

type PackageExports = Record<string, string>;

export type BuildIconsPackageOptions = {
  projectPath: string;
  outDir: string;
  packageName: string;
  packageVersion: string;
  builtAt?: string;
  fixtureProjectPathForValidation?: string;
};

export type BuildIconsPackageResult = {
  outDir: string;
  packageJsonPath: string;
  manifestPath: string;
  exportsPath: string;
  iconCount: number;
};

export async function buildIconsPackage(options: BuildIconsPackageOptions): Promise<BuildIconsPackageResult> {
  assertValidPackageIdentity(options.packageName, options.packageVersion);

  await runCompileCommand({
    projectPath: options.projectPath,
    outDir: options.outDir,
    packageName: options.packageName,
    packageVersion: options.packageVersion,
    builtAt: options.builtAt,
    generateReact: true,
  });

  await validateBuiltIconsPackage(options.outDir, {
    packageName: options.packageName,
    packageVersion: options.packageVersion,
  });

  const generatedExports = await loadGeneratedExports(options.outDir);
  const packageJson = makePublishedPackageJson({
    name: options.packageName,
    version: options.packageVersion,
    generatedExports,
  });

  const packageJsonPath = path.join(options.outDir, 'package.json');
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

  if (options.fixtureProjectPathForValidation) {
    await validateFixtureBuild(options.fixtureProjectPathForValidation, options.packageName);
  }

  const manifest = await loadManifest(options.outDir);

  return {
    outDir: options.outDir,
    packageJsonPath,
    manifestPath: path.join(options.outDir, 'icons.manifest.json'),
    exportsPath: path.join(options.outDir, 'package.exports.generated.json'),
    iconCount: Object.keys(manifest.icons).length,
  };
}

export async function validateBuiltIconsPackage(
  outDir: string,
  expected?: { packageName?: string; packageVersion?: string },
): Promise<void> {
  const manifest = await loadManifest(outDir);
  const generatedExports = await loadGeneratedExports(outDir);
  const iconCountFromMap = Object.keys(manifest.icons).length;

  if (manifest.package.iconCount <= 0 || iconCountFromMap === 0) {
    throw new Error('Validation failed: icon package is empty (manifest has no icons).');
  }

  if (manifest.package.iconCount !== iconCountFromMap) {
    throw new Error(
      `Validation failed: manifest iconCount (${manifest.package.iconCount}) does not match icon entries (${iconCountFromMap}).`,
    );
  }

  if (expected?.packageName && manifest.package.name !== expected.packageName) {
    throw new Error(
      `Validation failed: manifest package name mismatch (expected "${expected.packageName}", got "${manifest.package.name}").`,
    );
  }

  if (expected?.packageVersion && manifest.package.version !== expected.packageVersion) {
    throw new Error(
      `Validation failed: manifest package version mismatch (expected "${expected.packageVersion}", got "${manifest.package.version}").`,
    );
  }

  const iconSchemas = await getCompiledIconSchemaVersions(outDir, manifest);
  if (iconSchemas.size > 1) {
    throw new Error(`Validation failed: schema-version mismatch across compiled icons: ${[...iconSchemas].join(', ')}`);
  }

  const iconSchemaVersion = [...iconSchemas][0];
  if (!iconSchemaVersion) {
    throw new Error('Validation failed: no compiled icon files found while validating schema versions.');
  }

  if (manifest.package.iconSchemaVersion !== iconSchemaVersion) {
    throw new Error(
      `Validation failed: manifest iconSchemaVersion (${manifest.package.iconSchemaVersion}) does not match compiled icon schema (${iconSchemaVersion}).`,
    );
  }

  validateExportsShape(generatedExports);
  validateCollections(manifest, generatedExports);
  validatePerSizeEntries(manifest, generatedExports);

  for (const [key, relativeTarget] of Object.entries(generatedExports)) {
    const targetPath = resolveExportTargetPath(outDir, relativeTarget, key);
    const targetExists = await pathExists(targetPath);
    if (!targetExists) {
      throw new Error(`Validation failed: export target for "${key}" is missing: ${relativeTarget}`);
    }
  }

  const packageJsonPath = path.join(outDir, 'package.json');
  if (await pathExists(packageJsonPath)) {
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as Record<string, unknown>;
    assertPackageJsonConsistency(packageJson, generatedExports, expected);
  }
}

export function assertValidPackageIdentity(name: string, version: string): void {
  if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)) {
    throw new Error(`Invalid package name: "${name}".`);
  }

  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/.test(version)) {
    throw new Error(`Invalid package version: "${version}" (expected semver).`);
  }
}

function makePublishedPackageJson(input: {
  name: string;
  version: string;
  generatedExports: PackageExports;
}): Record<string, unknown> {
  const additionalExports: PackageExports = {
    './icons.manifest.json': './icons.manifest.json',
  };

  const collisions = Object.keys(additionalExports).filter((key) => key in input.generatedExports);
  if (collisions.length > 0) {
    throw new Error(`Duplicate export keys detected while generating package.json: ${collisions.join(', ')}`);
  }

  const exportsMap = Object.fromEntries(
    [...Object.entries(input.generatedExports), ...Object.entries(additionalExports)].sort(([a], [b]) =>
      a.localeCompare(b),
    ),
  );

  return {
    name: input.name,
    version: input.version,
    type: 'module',
    sideEffects: false,
    private: false,
    main: './generated/index.ts',
    types: './generated/index.ts',
    files: ['generated', 'icons', 'icons.manifest.json', 'package.exports.generated.json'],
    exports: exportsMap,
  };
}

async function validateFixtureBuild(fixtureProjectPath: string, packageName: string): Promise<void> {
  const fixtureOut = await mkdtemp(path.join(tmpdir(), 'icons-package-fixture-'));

  try {
    await runCompileCommand({
      projectPath: fixtureProjectPath,
      outDir: fixtureOut,
      packageName,
      packageVersion: '0.0.0-fixture',
      builtAt: '2026-01-01T00:00:00.000Z',
      generateReact: true,
    });

    await validateBuiltIconsPackage(fixtureOut);
  } finally {
    await rm(fixtureOut, { recursive: true, force: true });
  }
}

async function loadManifest(outDir: string): Promise<PackageManifest> {
  const manifestPath = path.join(outDir, 'icons.manifest.json');
  if (!(await pathExists(manifestPath))) {
    throw new Error(`Validation failed: missing required file icons.manifest.json in ${outDir}.`);
  }

  const parsed = JSON.parse(await readFile(manifestPath, 'utf8')) as unknown;
  if (!isPackageManifest(parsed)) {
    throw new Error('Validation failed: generated manifest is malformed.');
  }

  return parsed;
}

async function loadGeneratedExports(outDir: string): Promise<PackageExports> {
  const exportsPath = path.join(outDir, 'package.exports.generated.json');
  if (!(await pathExists(exportsPath))) {
    throw new Error(`Validation failed: missing required file package.exports.generated.json in ${outDir}.`);
  }

  const parsed = JSON.parse(await readFile(exportsPath, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Validation failed: generated exports file must be an object map.');
  }

  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!key.startsWith('.')) {
      throw new Error(`Validation failed: invalid export key "${key}".`);
    }

    if (typeof value !== 'string' || !value.startsWith('./')) {
      throw new Error(`Validation failed: export target for "${key}" must be a relative string path.`);
    }
  }

  return parsed as PackageExports;
}

function validateExportsShape(exportsMap: PackageExports): void {
  if (!exportsMap['.']) {
    throw new Error('Validation failed: missing root export ".".');
  }

  if (!exportsMap['./collections']) {
    throw new Error('Validation failed: missing "./collections" export.');
  }

  if (Object.keys(exportsMap).length !== new Set(Object.keys(exportsMap)).size) {
    throw new Error('Validation failed: duplicate export keys detected.');
  }
}

function validatePerSizeEntries(manifest: PackageManifest, exportsMap: PackageExports): void {
  for (const icon of Object.values(manifest.icons)) {
    for (const size of icon.supportedSizes) {
      const exportKey = `./sizes/${size}/${icon.componentName}`;
      if (!exportsMap[exportKey]) {
        throw new Error(
          `Validation failed: invalid per-size entry generation for ${icon.componentName} (${size}); missing export key ${exportKey}.`,
        );
      }
    }

    const iconExport = `./icons/${icon.componentName}`;
    if (!exportsMap[iconExport]) {
      throw new Error(`Validation failed: missing per-icon export key ${iconExport}.`);
    }
  }
}

function validateCollections(manifest: PackageManifest, exportsMap: PackageExports): void {
  for (const [collectionId, collection] of Object.entries(manifest.collections)) {
    for (const iconId of collection.iconIds) {
      if (!manifest.icons[iconId]) {
        throw new Error(
          `Validation failed: collection "${collectionId}" references unknown icon "${iconId}".`,
        );
      }
    }

    const collectionExportKey = `./collections/${collectionId}`;
    if (!exportsMap[collectionExportKey]) {
      throw new Error(`Validation failed: missing collection export key ${collectionExportKey}.`);
    }
  }
}

function assertPackageJsonConsistency(
  packageJson: Record<string, unknown>,
  exportsMap: PackageExports,
  expected?: { packageName?: string; packageVersion?: string },
): void {
  if (typeof packageJson.name !== 'string' || typeof packageJson.version !== 'string') {
    throw new Error('Validation failed: generated package.json must include string name/version.');
  }

  if (expected?.packageName && packageJson.name !== expected.packageName) {
    throw new Error(
      `Validation failed: generated package.json name mismatch (expected "${expected.packageName}", got "${packageJson.name}").`,
    );
  }

  if (expected?.packageVersion && packageJson.version !== expected.packageVersion) {
    throw new Error(
      `Validation failed: generated package.json version mismatch (expected "${expected.packageVersion}", got "${packageJson.version}").`,
    );
  }

  if (packageJson.type !== 'module') {
    throw new Error('Validation failed: generated package.json must set "type": "module".');
  }

  if (packageJson.sideEffects !== false) {
    throw new Error('Validation failed: generated package.json must set "sideEffects": false.');
  }

  const pkgExports = packageJson.exports;
  if (!pkgExports || typeof pkgExports !== 'object' || Array.isArray(pkgExports)) {
    throw new Error('Validation failed: generated package.json must include an exports map object.');
  }

  for (const [key, value] of Object.entries(exportsMap)) {
    if ((pkgExports as Record<string, unknown>)[key] !== value) {
      throw new Error(`Validation failed: package.json exports mismatch for key "${key}".`);
    }
  }

  const manifestExport = (pkgExports as Record<string, unknown>)['./icons.manifest.json'];
  if (manifestExport !== './icons.manifest.json') {
    throw new Error('Validation failed: package.json must export ./icons.manifest.json.');
  }
}

function resolveExportTargetPath(outDir: string, relativeTarget: string, exportKey: string): string {
  const targetPath = path.resolve(outDir, relativeTarget.replace(/^\.\//, ''));
  const normalizedOutDir = path.resolve(outDir);

  if (!targetPath.startsWith(`${normalizedOutDir}${path.sep}`) && targetPath !== normalizedOutDir) {
    throw new Error(
      `Validation failed: export target for "${exportKey}" points outside output dir: ${relativeTarget}`,
    );
  }

  return targetPath;
}

async function getCompiledIconSchemaVersions(
  outDir: string,
  manifest: PackageManifest,
): Promise<Set<string>> {
  const versions = new Set<string>();

  for (const icon of Object.values(manifest.icons)) {
    const iconPath = path.join(outDir, icon.compiledPath.replace(/^\.\//, ''));
    if (!(await pathExists(iconPath))) {
      throw new Error(`Validation failed: manifest references missing compiled icon file ${icon.compiledPath}.`);
    }

    const parsed = JSON.parse(await readFile(iconPath, 'utf8')) as unknown;
    if (!isCompiledIcon(parsed)) {
      throw new Error(`Validation failed: invalid compiled icon file at ${icon.compiledPath}.`);
    }

    const schemaVersionMatch = parsed.$schema.match(/^https:\/\/icophone\.dev\/schemas\/compiled-icon\/([^/]+)$/);
    if (!schemaVersionMatch) {
      throw new Error(`Validation failed: unexpected compiled icon schema URI: ${parsed.$schema}`);
    }

    versions.add(schemaVersionMatch[1]!);
  }

  return versions;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}
