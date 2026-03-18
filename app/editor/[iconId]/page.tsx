import { EditorShell } from '@/components/editor/EditorShell';

export async function generateStaticParams() {
  return [{ iconId: 'desktop-shell' }];
}

export default async function EditorPage({
  params,
}: {
  params: Promise<{ iconId: string }>;
}) {
  const { iconId } = await params;
  return <EditorShell initialIconId={iconId} />;
}
