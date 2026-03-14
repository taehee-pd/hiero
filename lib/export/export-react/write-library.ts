import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { FileMap } from './generate-library';

export function writeIconLibrary(fileMap: FileMap, outputDir: string): void {
  const root = resolve(outputDir);
  for (const [relativePath, contents] of Object.entries(fileMap)) {
    const targetPath = resolve(root, relativePath);
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, contents, 'utf8');
  }
}
