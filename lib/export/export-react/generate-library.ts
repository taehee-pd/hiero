import type { Project } from '@/lib/schema/types';
import { generateIconComponent } from './generate-component';

export type FileMap = Record<string, string>;

export function generateIconLibrary(
  project: Project,
  options?: { outputDir?: string; typescript?: boolean; packageName?: string },
): FileMap {
  const typescript = options?.typescript !== false;
  const ext = typescript ? 'tsx' : 'jsx';
  const outputDir = trimSlashes(options?.outputDir ?? 'src');
  const packageName = (options?.packageName ?? toKebab(project.meta.name)) || 'coniva-icons';

  const files: FileMap = {};
  const exportRows: string[] = [];

  const iconEntries = Object.values(project.icons).sort((a, b) => a.name.localeCompare(b.name));
  for (const icon of iconEntries) {
    const componentName = toPascal(icon.name || icon.id);
    const filePath = `${outputDir}/${componentName}.${ext}`;
    files[filePath] = generateIconComponent(icon, { typescript });
    exportRows.push(`export { ${componentName} } from './${componentName}';`);
  }

  files[`${outputDir}/index.${typescript ? 'ts' : 'js'}`] = `${exportRows.join('\n')}\n`;

  files['package.json'] = `${JSON.stringify(
    {
      name: packageName,
      version: '0.1.0',
      private: false,
      main: typescript ? 'dist/index.cjs' : 'src/index.js',
      module: typescript ? 'dist/index.js' : 'src/index.js',
      types: typescript ? 'dist/index.d.ts' : undefined,
      peerDependencies: {
        react: '^18 || ^19',
      },
    },
    null,
    2,
  )}\n`;

  files['tsconfig.json'] = `${JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        jsx: 'react-jsx',
        declaration: true,
        outDir: 'dist',
        strict: true,
        moduleResolution: 'Bundler',
        esModuleInterop: true,
        skipLibCheck: true,
      },
      include: [outputDir],
    },
    null,
    2,
  )}\n`;

  return files;
}

function toPascal(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('');
}

function toKebab(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '') || 'src';
}
