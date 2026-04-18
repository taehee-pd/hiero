'use client';

import { useState } from 'react';

import { CuneiformIcon, useIconState } from '@/lib/runtime-react';
import { HAMBURGER_CLOSE_ICON } from '@/lib/schema/sample-icons/hamburger-close';
import { SAMPLE_PROJECT } from '@/lib/schema/sample-project';
import { exportRuntimeIconVariant } from '@/lib/export/export-runtime-json';

const homeIcon = SAMPLE_PROJECT.icons['icon-home']!;
export default function RuntimeDemoPage() {
  const [hamburgerVariant, setHamburgerVariant] = useState<'24-open' | '24-closed'>('24-open');
  const home = useIconState('default');
  const [animate, setAnimate] = useState(true);
  const [exportResult, setExportResult] = useState<string | null>(null);

  function handleExportRuntimeJson() {
    try {
      const result = exportRuntimeIconVariant(SAMPLE_PROJECT, 'icon-home', 'v24');
      setExportResult(JSON.stringify(result.variant, null, 2).slice(0, 500) + '\n...');
      if (result.diagnostics.length > 0) {
        setExportResult((prev) =>
          `${prev}\n\nDiagnostics:\n${result.diagnostics.map((d) => `- [${d.code}] ${d.message}`).join('\n')}`,
        );
      }
    } catch (error) {
      setExportResult(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center gap-12 p-8">
      <h1 className="text-2xl font-bold">Runtime Demo</h1>

      <div className="flex gap-16">
        {/* Hamburger → Close demo */}
        <section className="flex flex-col items-center gap-4">
          <h2 className="text-lg font-semibold">Hamburger / Close</h2>
          <CuneiformIcon
            icon={HAMBURGER_CLOSE_ICON}
            variant={hamburgerVariant}
            animate={animate}
            size={72}
          />
          <button
            type="button"
            className="w-36 rounded border px-4 py-2"
            onClick={() =>
              setHamburgerVariant(hamburgerVariant === '24-open' ? '24-closed' : '24-open')
            }
          >
            Toggle ({hamburgerVariant === '24-open' ? 'open' : 'closed'})
          </button>
        </section>

        {/* Home icon demo */}
        <section className="flex flex-col items-center gap-4">
          <h2 className="text-lg font-semibold">Home</h2>
          <CuneiformIcon
            icon={homeIcon}
            variant="v24"
            state={home.state}
            animate={animate}
            size={72}
            color="#2563eb"
          />
          <p className="text-sm text-muted-foreground">State: {home.state}</p>
        </section>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={animate}
            onChange={(e) => setAnimate(e.target.checked)}
          />
          Animate transitions
        </label>
      </div>

      {/* Runtime JSON export validation */}
      <section className="flex flex-col items-center gap-4">
        <h2 className="text-lg font-semibold">Export Pipeline</h2>
        <button
          type="button"
          className="rounded border px-4 py-2"
          onClick={handleExportRuntimeJson}
        >
          Export Home → Runtime JSON
        </button>
        {exportResult && (
          <pre className="max-w-xl overflow-auto rounded bg-muted p-4 text-xs">
            {exportResult}
          </pre>
        )}
      </section>
    </main>
  );
}
