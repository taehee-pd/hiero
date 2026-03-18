#!/usr/bin/env node

// Repo-local Electrobun compatibility shim.
//
// The published Electrobun package currently fails for this project in two ways:
// 1. its wrapper/binary path can error with a non-diagnostic "Bundle failed"
// 2. its source CLI expects source-side modules that are not shipped in the package
// 3. its bundled runtime emits invalid syntax from top-level await in BrowserView/BrowserWindow
//
// We patch the installed package after `pnpm install` so `electrobun dev/build`
// resolve to the working source CLI path for this repo.

const fs = require('fs');
const path = require('path');

const packageRoot = path.resolve(__dirname, '..');
const electrobunRoot = path.join(packageRoot, 'node_modules', 'electrobun');
const electrobunBinDir = path.join(packageRoot, 'node_modules', 'electrobun', 'bin');
const wrapperPath = path.join(electrobunBinDir, 'electrobun.cjs');
const originalPath = path.join(electrobunBinDir, 'electrobun.original.cjs');
const srcSharedPath = path.join(electrobunRoot, 'src', 'shared');
const distSharedPath = path.join(electrobunRoot, 'dist', 'api', 'shared');
const embeddedTemplatePath = path.join(electrobunRoot, 'src', 'cli', 'templates', 'embedded.ts');
const sourceCliPath = path.join(electrobunRoot, 'src', 'cli', 'index.ts');
const browserWindowRuntimePath = path.join(electrobunRoot, 'dist', 'api', 'bun', 'core', 'BrowserWindow.ts');
const browserViewRuntimePath = path.join(electrobunRoot, 'dist', 'api', 'bun', 'core', 'BrowserView.ts');

if (!fs.existsSync(wrapperPath)) {
  process.exit(0);
}

const shim = `#!/usr/bin/env node

const { spawn } = require('child_process');
const { existsSync } = require('fs');
const { join } = require('path');

const projectRoot = process.cwd();
const args = process.argv.slice(2);
const cliPath = join(__dirname, '..', 'src', 'cli', 'index.ts');

if (existsSync(cliPath)) {
  const child = spawn('bun', [cliPath, ...args], {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });

  child.on('error', (error) => {
    console.error('Failed to start patched Electrobun CLI:', error.message);
    process.exit(1);
  });
} else {
  require(join(__dirname, 'electrobun.original.cjs'));
}
`;

if (!fs.existsSync(originalPath)) {
  fs.copyFileSync(wrapperPath, originalPath);
}

fs.mkdirSync(path.dirname(embeddedTemplatePath), { recursive: true });
if (!fs.existsSync(srcSharedPath)) {
  fs.mkdirSync(path.dirname(srcSharedPath), { recursive: true });
  fs.symlinkSync(path.relative(path.dirname(srcSharedPath), distSharedPath), srcSharedPath, 'dir');
}

fs.writeFileSync(
  embeddedTemplatePath,
  `export function getTemplateNames(): string[] {
  return [];
}

export function getTemplate(_name: string): null {
  return null;
}
`,
  'utf8',
);

if (fs.existsSync(sourceCliPath)) {
  const sourceCli = fs.readFileSync(sourceCliPath, 'utf8')
    .replace("rmdirSync(buildFolder, { recursive: true });", "rmSync(buildFolder, { recursive: true, force: true });")
    .replace("rmdirSync(appDirPath, { recursive: true });", "rmSync(appDirPath, { recursive: true, force: true });")
    .replace("rmdirSync(appBundleFolderPath, { recursive: true });", "rmSync(appBundleFolderPath, { recursive: true, force: true });")
    .replace("rmdirSync(artifactFolder, { recursive: true });", "rmSync(artifactFolder, { recursive: true, force: true });")
    .replace(
      /async function takeoverForeground\(\): Promise<\(\) => void> \{[\s\S]*?\n\t\}/,
      'async function takeoverForeground(): Promise<() => void> {\n\t\treturn () => {};\n\t}',
    );
  fs.writeFileSync(sourceCliPath, sourceCli, 'utf8');
}

if (fs.existsSync(browserWindowRuntimePath)) {
  const browserWindowRuntime = fs.readFileSync(browserWindowRuntimePath, 'utf8')
    .replace('import { BuildConfig } from "./BuildConfig";\n', 'import { readFileSync } from "fs";\nimport { join } from "path";\n')
    .replace(
      'const buildConfig = await BuildConfig.get();',
      `const buildConfig = (() => {
\ttry {
\t\treturn JSON.parse(
\t\t\treadFileSync(join(process.cwd(), "..", "Resources", "build.json"), "utf8"),
\t\t);
\t} catch {
\t\treturn {
\t\t\tdefaultRenderer: "native",
\t\t\tavailableRenderers: ["native"],
\t\t};
\t}
})();`,
    );
  fs.writeFileSync(browserWindowRuntimePath, browserWindowRuntime, 'utf8');
}

if (fs.existsSync(browserViewRuntimePath)) {
  const browserViewRuntime = fs.readFileSync(browserViewRuntimePath, 'utf8')
    .replace('import * as fs from "fs";\n', 'import * as fs from "fs";\nimport { join } from "path";\n')
    .replace(/import \{ join \} from "path";\nimport \{ join \} from "path";\n/g, 'import { join } from "path";\n')
    .replace('import { Updater } from "./Updater";\n', '')
    .replace('import { BuildConfig } from "./BuildConfig";\n', '')
    .replace(
      'const hash = await Updater.localInfo.hash();\nconst buildConfig = await BuildConfig.get();',
      `const hash = (() => {
\ttry {
\t\tconst localInfo = JSON.parse(
\t\t\tfs.readFileSync(join(process.cwd(), "..", "Resources", "version.json"), "utf8"),
\t\t);
\t\treturn localInfo.hash || "dev";
\t} catch {
\t\treturn "dev";
\t}
})();
const buildConfig = (() => {
\ttry {
\t\treturn JSON.parse(
\t\t\tfs.readFileSync(join(process.cwd(), "..", "Resources", "build.json"), "utf8"),
\t\t);
\t} catch {
\t\treturn {
\t\t\tdefaultRenderer: "native",
\t\t\tavailableRenderers: ["native"],
\t\t};
\t}
})();`,
    );
  fs.writeFileSync(browserViewRuntimePath, browserViewRuntime, 'utf8');
}

fs.writeFileSync(wrapperPath, shim, 'utf8');
fs.chmodSync(wrapperPath, 0o755);
