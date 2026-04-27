import { RuntimeDemo } from '@/components/runtime/RuntimeDemo';
import { definePage } from '@/lib/routes/define-page';

export default function RuntimeDemoPage() {
  return definePage({ route: '/runtime-demo', children: <RuntimeDemo /> });
}
