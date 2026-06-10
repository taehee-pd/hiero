'use client';

import { definePage } from '@/lib/routes/define-page';
import { SharedIconView } from '@/components/share/SharedIconView';

export default function SharePage() {
  return definePage({
    route: '/share',
    children: <SharedIconView />,
  });
}
