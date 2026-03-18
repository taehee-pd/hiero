import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type CoverageTotals = {
  linesFound: number;
  linesHit: number;
  functionsFound: number;
  functionsHit: number;
  branchesFound: number;
  branchesHit: number;
};

type RecordTotals = CoverageTotals & {
  usesDetailedCounts: boolean;
  summaryLinesFound: number;
  summaryLinesHit: number;
  summaryFunctionsFound: number;
  summaryFunctionsHit: number;
  summaryBranchesFound: number;
  summaryBranchesHit: number;
};

type Thresholds = {
  minLines: number;
  minFunctions: number;
  minBranches?: number;
};

type CoverageCheckOptions = {
  include: string[];
};

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;

    const [key, inlineValue] = token.split('=', 2);
    if (inlineValue !== undefined) {
      args.set(key, inlineValue);
      continue;
    }

    const nextValue = argv[index + 1];
    if (nextValue && !nextValue.startsWith('--')) {
      args.set(key, nextValue);
      index += 1;
    } else {
      args.set(key, 'true');
    }
  }

  return args;
}

function toNumber(value: string | undefined, fallback: number): number {
  if (value == null || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value: ${value}`);
  }
  return parsed;
}

function emptyTotals(): RecordTotals {
  return {
    linesFound: 0,
    linesHit: 0,
    functionsFound: 0,
    functionsHit: 0,
    branchesFound: 0,
    branchesHit: 0,
    usesDetailedCounts: false,
    summaryLinesFound: 0,
    summaryLinesHit: 0,
    summaryFunctionsFound: 0,
    summaryFunctionsHit: 0,
    summaryBranchesFound: 0,
    summaryBranchesHit: 0,
  };
}

function matchesInclude(filePath: string | null, include: string[]): boolean {
  if (!filePath) return include.length === 0;
  if (include.length === 0) return true;
  return include.some((prefix) => filePath.startsWith(prefix));
}

function parseLcovFile(lcovContents: string, options: CoverageCheckOptions): CoverageTotals {
  const totals = emptyTotals();
  let record = emptyTotals();
  let recordHasData = false;
  let currentFile: string | null = null;

  const flushRecord = () => {
    if (!recordHasData) {
      record = emptyTotals();
      currentFile = null;
      return;
    }

    const nextTotals = record.usesDetailedCounts
      ? {
          linesFound: record.linesFound,
          linesHit: record.linesHit,
          functionsFound: record.functionsFound,
          functionsHit: record.functionsHit,
          branchesFound: record.branchesFound,
          branchesHit: record.branchesHit,
        }
      : {
          linesFound: record.summaryLinesFound,
          linesHit: record.summaryLinesHit,
          functionsFound: record.summaryFunctionsFound,
          functionsHit: record.summaryFunctionsHit,
          branchesFound: record.summaryBranchesFound,
          branchesHit: record.summaryBranchesHit,
        };

    if (matchesInclude(currentFile, options.include)) {
      totals.linesFound += nextTotals.linesFound;
      totals.linesHit += nextTotals.linesHit;
      totals.functionsFound += nextTotals.functionsFound;
      totals.functionsHit += nextTotals.functionsHit;
      totals.branchesFound += nextTotals.branchesFound;
      totals.branchesHit += nextTotals.branchesHit;
    }

    record = emptyTotals();
    recordHasData = false;
    currentFile = null;
  };

  for (const rawLine of lcovContents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line === 'end_of_record') {
      flushRecord();
      continue;
    }

    if (line.startsWith('SF:')) {
      currentFile = line.slice(3);
      continue;
    }

    if (line.startsWith('DA:')) {
      record.usesDetailedCounts = true;
      recordHasData = true;
      record.linesFound += 1;
      const [, count = '0'] = line.slice(3).split(',', 2);
      if (Number(count) > 0) {
        record.linesHit += 1;
      }
      continue;
    }

    if (line.startsWith('FNDA:')) {
      record.usesDetailedCounts = true;
      recordHasData = true;
      record.functionsFound += 1;
      const [count = '0'] = line.slice(5).split(',', 2);
      if (Number(count) > 0) {
        record.functionsHit += 1;
      }
      continue;
    }

    if (line.startsWith('BRDA:')) {
      record.usesDetailedCounts = true;
      recordHasData = true;
      record.branchesFound += 1;
      const pieces = line.slice(5).split(',');
      const hitCount = pieces[3] ?? '-';
      if (hitCount !== '-' && Number(hitCount) > 0) {
        record.branchesHit += 1;
      }
      continue;
    }

    if (line.startsWith('LF:')) {
      recordHasData = true;
      record.summaryLinesFound = Number(line.slice(3));
      continue;
    }

    if (line.startsWith('LH:')) {
      recordHasData = true;
      record.summaryLinesHit = Number(line.slice(3));
      continue;
    }

    if (line.startsWith('FNF:')) {
      recordHasData = true;
      record.summaryFunctionsFound = Number(line.slice(4));
      continue;
    }

    if (line.startsWith('FNH:')) {
      recordHasData = true;
      record.summaryFunctionsHit = Number(line.slice(4));
      continue;
    }

    if (line.startsWith('BRF:')) {
      recordHasData = true;
      record.summaryBranchesFound = Number(line.slice(4));
      continue;
    }

    if (line.startsWith('BRH:')) {
      recordHasData = true;
      record.summaryBranchesHit = Number(line.slice(4));
    }
  }

  if (recordHasData) {
    flushRecord();
  }

  return totals;
}

function percentage(hit: number, found: number): number {
  if (found === 0) return 100;
  return (hit / found) * 100;
}

function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`;
}

function writeSummary(summary: string) {
  const output = process.env.GITHUB_STEP_SUMMARY;
  if (!output) return;

  writeFileSync(output, `${summary}\n`, { flag: 'a' });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const coverageDir = args.get('--coverage-dir') ?? 'coverage';
  const include = [
    ...new Set(
      (args.get('--include') ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
  const thresholds: Thresholds = {
    minLines: toNumber(args.get('--min-lines'), 0),
    minFunctions: toNumber(args.get('--min-functions'), 0),
  };

  const minBranchesArg = args.get('--min-branches');
  if (minBranchesArg != null) {
    thresholds.minBranches = toNumber(minBranchesArg, 0);
  }

  const lcovPath = path.resolve(process.cwd(), coverageDir, 'lcov.info');
  if (!existsSync(lcovPath)) {
    throw new Error(`Coverage report not found: ${lcovPath}`);
  }

  const lcovContents = readFileSync(lcovPath, 'utf8');
  const totals = parseLcovFile(lcovContents, { include });

  const linesCoverage = percentage(totals.linesHit, totals.linesFound);
  const functionCoverage = percentage(totals.functionsHit, totals.functionsFound);
  const branchCoverage = percentage(totals.branchesHit, totals.branchesFound);

  const linesOk = linesCoverage >= thresholds.minLines;
  const functionsOk = functionCoverage >= thresholds.minFunctions;
  const branchesOk = thresholds.minBranches == null || branchCoverage >= thresholds.minBranches;

  const summary = [
    '## Coverage summary',
    '',
    include.length > 0
      ? `Included paths: \`${include.join('`, `')}\``
      : 'Included paths: all files',
    '',
    '| Metric | Covered | Total | Coverage | Threshold | Status |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
    `| Lines | ${totals.linesHit} | ${totals.linesFound} | ${formatPercentage(linesCoverage)} | ${formatPercentage(thresholds.minLines)} | ${linesOk ? 'pass' : 'fail'} |`,
    `| Functions | ${totals.functionsHit} | ${totals.functionsFound} | ${formatPercentage(functionCoverage)} | ${formatPercentage(thresholds.minFunctions)} | ${functionsOk ? 'pass' : 'fail'} |`,
    `| Branches | ${totals.branchesHit} | ${totals.branchesFound} | ${formatPercentage(branchCoverage)} | ${thresholds.minBranches == null ? 'n/a' : formatPercentage(thresholds.minBranches)} | ${branchesOk ? 'pass' : 'fail'} |`,
  ].join('\n');

  console.log(summary);
  writeSummary(summary);

  const failures: string[] = [];
  if (!linesOk) {
    failures.push(
      `line coverage ${formatPercentage(linesCoverage)} is below ${formatPercentage(thresholds.minLines)}`,
    );
  }
  if (!functionsOk) {
    failures.push(
      `function coverage ${formatPercentage(functionCoverage)} is below ${formatPercentage(thresholds.minFunctions)}`,
    );
  }
  if (!branchesOk && thresholds.minBranches != null) {
    failures.push(
      `branch coverage ${formatPercentage(branchCoverage)} is below ${formatPercentage(thresholds.minBranches)}`,
    );
  }

  if (failures.length > 0) {
    throw new Error(`Coverage threshold check failed:\n- ${failures.join('\n- ')}`);
  }
}

main();
