import { Icon as UiIcon } from '@hiero/ui-icons';
import { cn } from '@/lib/utils';

function Spinner({ className }: { className?: string }) {
  return (
    <UiIcon
      name="loader-2"
      role="status"
      aria-label="Loading"
      className={cn('size-4 animate-spin', className)}
    />
  );
}

export { Spinner };
