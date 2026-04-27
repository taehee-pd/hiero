import { definePage } from '@/lib/routes/define-page';

export async function generateStaticParams() {
  return [{ iconId: 'desktop-shell' }];
}

export default async function EditorPage({
  params,
}: {
  params: Promise<{ iconId: string }>;
}) {
  const { iconId } = await params;
  return definePage({ route: '/editor/[iconId]', iconId });
}
