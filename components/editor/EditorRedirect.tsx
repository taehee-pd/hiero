'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { buildEditorRoute } from '@/lib/platform/routes';

export function EditorRedirect({ iconId }: { iconId?: string }) {
  const router = useRouter();

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const iconSetId =
      search.get('project') ?? search.get('set') ?? undefined;
    const targetIconId = iconId ?? search.get('icon') ?? undefined;
    router.replace(buildEditorRoute(targetIconId, iconSetId));
  }, [router, iconId]);

  return null;
}
