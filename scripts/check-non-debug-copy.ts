#!/usr/bin/env bun
/**
 * W1-U2 — Banned-vocabulary copy lint.
 *
 * The transition resolver's algorithm vocabulary
 * (`Hungarian`, `intrinsic`, `ARAP`, `contour tree`, `turning function`,
 * `medial axis`, `cascade tier`, `Sederberg`, `Baxter`, `Igarashi`, …)
 * must not appear in user-facing copy. The only authorized crossing
 * point between algorithm vocabulary and user-facing strings is
 * `lib/runtime-core/transition-signal-messages.ts → signalToSentence`,
 * which translates structured signals into plain language.
 *
 * This script greps the user-facing surfaces (`components/`, `app/`,
 * `messages/` if it exists) and the runtime-react module for any
 * occurrence of the banned terms in string literals or JSX text.
 *
 * Files / blocks that are *legitimately* engineer-facing are excluded:
 *   - `*.test.ts(x)` / `*.spec.ts(x)`
 *   - `*.stories.tsx`
 *   - `*.debug.*`
 *   - `*Debug*.tsx` (debug components like the future TransitionDebugPill)
 *   - The translator module itself (`transition-signal-messages.ts`)
 *   - Non-debug strings inside a `process.env.NEXT_PUBLIC_HIERO_DEBUG`
 *     conditional block (TODO once the debug pill ships in W4-9)
 *
 * Mirrors the style of `scripts/check-page-registry.ts`.
 *
 * Plan: docs_canonical/ICON_TRANSITION_INTEGRATED_PLAN.md §3 invariant 6,
 * docs_canonical/ICON_TRANSITION_UX_PLAN.md §1 + §11.6.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

function parseRoot(argv: string[]): string {
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--root' && argv[i + 1]) {
      return resolve(argv[i + 1]!);
    }
  }
  return resolve(import.meta.dir, '..');
}

const ROOT = parseRoot(process.argv);

const ROOTS_TO_SCAN = ['components', 'app', 'lib/runtime-react'];

const SKIP_DIR_RE = /^(node_modules|\.next|\.turbo|\.git|dist|build|coverage|storybook-static)$/;
// Skip filenames that are intentionally engineer-facing surfaces:
//   - *.test.tsx / *.spec.tsx / *.stories.tsx — test + Storybook
//   - *.debug.tsx                              — convention prefix
//   - *Debug*.tsx / *Debug*.ts                 — "anything-Debug-anything"
//                                                catches TransitionDebugPill.tsx
//                                                and friends regardless of
//                                                trailing form
//   - *.d.ts                                   — type declarations
const SKIP_FILE_RE =
  /\.(test|spec|stories)\.(t|j)sx?$|\.debug\.(t|j)sx?$|Debug.*\.(t|j)sx?$|\.d\.ts$/;

const FILE_EXT_RE = /\.(t|j)sx?$/;

/**
 * Banned terms (case-insensitive). Hits inside string literals,
 * template strings, and JSX text fail the lint. Hits inside code
 * (variable names, type names, imports) are allowed — the lint is a
 * copy lint, not an identifier lint.
 */
const BANNED_TERMS = [
  'Hungarian',
  'intrinsic morph',
  'intrinsic interpolation',
  'ARAP',
  'contour tree',
  'turning function',
  'medial axis',
  'cascade tier',
  'distortion floor',
  'Sederberg',
  'Baxter',
  'Igarashi',
  'Floater',
  'Wasserstein',
  'Tiller-Hanson',
  'Aichholzer',
];

/**
 * Files that legitimately reference algorithm vocabulary in
 * user-visible places (e.g. the algorithm plan docs themselves).
 * Empty by default; add via paste-ready snippet from the failure
 * output if a genuine exception comes up.
 */
const ALLOWLIST = new Set<string>([]);

type Hit = {
  file: string;
  line: number;
  term: string;
  context: string;
};

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIR_RE.test(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (FILE_EXT_RE.test(entry) && !SKIP_FILE_RE.test(entry)) {
      out.push(full);
    }
  }
}

/**
 * Pull literal-text spans out of a TypeScript source — string
 * literals, template strings, and JSX text. Skips comments and
 * code identifiers. Lightweight and intentionally not a real parser
 * (the cost of a full TS AST per file is too high for a lint that
 * runs on every commit); false positives from oddly-formatted
 * sources are escaped via the per-file ALLOWLIST.
 */
function extractLiteralSpans(source: string): Array<{ line: number; text: string }> {
  const spans: Array<{ line: number; text: string }> = [];
  const lines = source.split('\n');
  // String literal regex: matches "...", '...', `...` (template
  // strings flatten ${} interpolations to their literal segments).
  const stringRe =
    /"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|`((?:\\.|[^`\\])*)`/g;
  // JSX text: any non-{}<> chunk between > and < that includes a
  // letter. Conservative — false positives are rare.
  const jsxRe = />([^<>{}]*[A-Za-z][^<>{}]*)</g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim().startsWith('//')) continue;

    let match: RegExpExecArray | null;
    while ((match = stringRe.exec(line)) !== null) {
      const text = match[1] ?? match[2] ?? match[3] ?? '';
      if (text.trim().length > 0) spans.push({ line: i + 1, text });
    }
    while ((match = jsxRe.exec(line)) !== null) {
      const text = match[1] ?? '';
      if (text.trim().length > 0) spans.push({ line: i + 1, text: text.trim() });
    }
  }

  return spans;
}

function scanFile(absPath: string): Hit[] {
  const rel = relative(ROOT, absPath);
  if (ALLOWLIST.has(rel)) return [];
  const source = readFileSync(absPath, 'utf-8');
  const spans = extractLiteralSpans(source);
  const hits: Hit[] = [];
  for (const span of spans) {
    for (const term of BANNED_TERMS) {
      const re = new RegExp(`\\b${escapeRegex(term)}\\b`, 'i');
      if (re.test(span.text)) {
        hits.push({
          file: rel,
          line: span.line,
          term,
          context: span.text.slice(0, 160),
        });
      }
    }
  }
  return hits;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function main() {
  const files: string[] = [];
  for (const root of ROOTS_TO_SCAN) {
    walk(resolve(ROOT, root), files);
  }

  const allHits: Hit[] = [];
  for (const file of files) {
    allHits.push(...scanFile(file));
  }

  if (allHits.length === 0) {
    console.log(`OK — scanned ${files.length} files, no banned vocabulary in user-facing copy.`);
    process.exit(0);
  }

  console.error(
    `FAIL — found ${allHits.length} banned-vocabulary leak(s) in user-facing copy:\n`,
  );
  for (const hit of allHits) {
    console.error(`  ${hit.file}:${hit.line}  "${hit.term}" → ${hit.context}`);
  }
  console.error(
    '\nFix: rephrase the user-facing copy in plain language. See ' +
      'docs_canonical/ICON_TRANSITION_UX_PLAN.md §1 for the contract. ' +
      'Algorithm vocabulary is allowed only in:\n' +
      '  - debug surfaces (gated on NEXT_PUBLIC_HIERO_DEBUG=1)\n' +
      '  - test fixtures (*.test.ts, *.stories.tsx)\n' +
      '  - documentation under docs_canonical/\n' +
      '\nIf this is a legitimate exception, add the file path to ALLOWLIST in scripts/check-non-debug-copy.ts.',
  );
  process.exit(1);
}

main();
