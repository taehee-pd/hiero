import { buildStaticExport, runCommand, stageExportedMainview, workspaceRoot } from './build-utils';

const shouldBuildInstallers = Bun.argv.includes('--dist');

await buildStaticExport();
stageExportedMainview();

await runCommand(
  ['corepack', 'pnpm', '--dir', 'desktop', shouldBuildInstallers ? 'dist' : 'build'],
  workspaceRoot,
);
