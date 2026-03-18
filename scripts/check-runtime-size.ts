import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const RUNTIME_CORE_FILES = [
  // Baseline runtime animation entrypoints used by runtime-dom in production paths.
  // Morph/topology helpers are intentionally excluded because they are lazy/conditional
  // and should be tracked in a dedicated advanced-animation budget.
  'lib/runtime-core/easing.ts',
  'lib/runtime-core/scheduler.ts',
  'lib/runtime-core/draw-executor.ts',
  'lib/runtime-core/effect-scheduler.ts',
  'lib/runtime-core/motion-preference.ts',
];

const RUNTIME_CORE_GZIP_LIMIT_BYTES = 10 * 1024;
const PER_ICON_GZIP_LIMIT_BYTES = 2 * 1024;

function gzipSize(contents: string): number {
  return gzipSync(Buffer.from(contents, 'utf8')).byteLength;
}

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(2)}KB`;
}

function main() {
  const runtimeCorePayload = RUNTIME_CORE_FILES
    .map((file) => readFileSync(path.join(ROOT, file), 'utf8'))
    .join('\n');
  const runtimeCoreGzip = gzipSize(runtimeCorePayload);

  const iconFixturePath = path.join(
    ROOT,
    'tests/fixtures/compiler-contracts/compiled-icon.json',
  );
  const iconFixture = readFileSync(iconFixturePath, 'utf8');
  const iconFixtureGzip = gzipSize(iconFixture);

  console.log('Runtime size check:');
  console.log(
    `- runtime-core baseline source bundle (proxy): ${formatKb(runtimeCoreGzip)} / ${formatKb(RUNTIME_CORE_GZIP_LIMIT_BYTES)}`,
  );
  console.log(
    `- compiled icon fixture: ${formatKb(iconFixtureGzip)} / ${formatKb(PER_ICON_GZIP_LIMIT_BYTES)}`,
  );

  const failures: string[] = [];
  if (runtimeCoreGzip > RUNTIME_CORE_GZIP_LIMIT_BYTES) {
    failures.push(
      `runtime-core gzip size exceeded limit (${runtimeCoreGzip} > ${RUNTIME_CORE_GZIP_LIMIT_BYTES})`,
    );
  }
  if (iconFixtureGzip > PER_ICON_GZIP_LIMIT_BYTES) {
    failures.push(
      `per-icon gzip size exceeded limit (${iconFixtureGzip} > ${PER_ICON_GZIP_LIMIT_BYTES})`,
    );
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`ERROR: ${failure}`);
    }
    process.exit(1);
  }
}

main();
