import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const workspaceRoot = resolve(import.meta.dir, '../..');
export const desktopRoot = resolve(import.meta.dir, '..');
export const nextOutDir = join(workspaceRoot, 'out');
export const stagedMainviewDir = join(desktopRoot, '.generated', 'mainview');

export async function buildStaticExport() {
  await runCommand(['corepack', 'pnpm', 'build'], workspaceRoot, {
    NEXT_OUTPUT_MODE: 'export',
  });
}

export function stageExportedMainview() {
  rmSync(stagedMainviewDir, { recursive: true, force: true });
  mkdirSync(stagedMainviewDir, { recursive: true });
  cpSync(nextOutDir, stagedMainviewDir, { recursive: true });
  injectElectroviewBootstrap(stagedMainviewDir);
}

export async function runCommand(
  command: string[],
  cwd: string,
  envOverrides?: Record<string, string>,
) {
  const proc = Bun.spawn(command, {
    cwd,
    env: {
      ...process.env,
      ...envOverrides,
    },
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Command failed (${exitCode}): ${command.join(' ')}`);
  }
}

function injectElectroviewBootstrap(rootDir: string) {
  const bootstrapTag =
    '<script type="module" src="views://mainview/index.js" data-electrobun-mainview></script>';

  for (const filePath of walkFiles(rootDir)) {
    if (!filePath.endsWith('.html')) continue;

    const html = readFileSync(filePath, 'utf8');
    if (html.includes('data-electrobun-mainview')) continue;

    const nextHtml = html.includes('</body>')
      ? html.replace('</body>', `  ${bootstrapTag}\n</body>`)
      : `${html}\n${bootstrapTag}\n`;

    writeFileSync(filePath, nextHtml, 'utf8');
  }
}

function walkFiles(rootDir: string): string[] {
  const pending = [rootDir];
  const files: string[] = [];

  while (pending.length > 0) {
    const currentDir = pending.pop()!;
    for (const entry of readdirSync(currentDir)) {
      const filePath = join(currentDir, entry);
      const stat = statSync(filePath);
      if (stat.isDirectory()) {
        pending.push(filePath);
      } else {
        files.push(filePath);
      }
    }
  }

  return files;
}
