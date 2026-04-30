'use client';

import { definePage } from '@/lib/routes/define-page';
import { HistoryView } from '@/components/studio/history/HistoryView';

export default function HistoryPage() {
  return definePage({
    route: '/history',
    children: <HistoryView />,
  });
}
