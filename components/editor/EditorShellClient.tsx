'use client';

import dynamic from 'next/dynamic';

const EditorShell = dynamic(
  () =>
    import('@/components/editor/EditorShell').then((mod) => ({
      default: mod.EditorShell,
    })),
  { ssr: false },
);

export function EditorShellClient({
  initialIconId,
}: {
  initialIconId?: string;
}) {
  return <EditorShell initialIconId={initialIconId} />;
}
