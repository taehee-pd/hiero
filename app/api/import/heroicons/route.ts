import { NextResponse } from 'next/server';
import { heroiconsAdapter } from '@/lib/import/adapters/heroicons-adapter';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { iconName?: string };
    const iconName = body.iconName?.trim();
    if (!iconName) {
      return NextResponse.json({ error: 'iconName is required' }, { status: 400 });
    }

    const result = await heroiconsAdapter.fetch({
      mode: 'library-icon-name',
      iconId: iconName,
      name: iconName,
    });

    return NextResponse.json({
      svgContent: result.svgContent,
      suggestedName: result.suggestedName,
      suggestedTags: result.suggestedTags,
      provenance: result.provenance,
    });
  } catch {
    return NextResponse.json({ error: 'icon_not_found' }, { status: 404 });
  }
}
