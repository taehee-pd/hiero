/**
 * Built-in adapter registrations.
 *
 * Import this module at app init time to register all built-in adapters
 * with the shared adapter registry.
 */

import { adapterRegistry } from '../adapter-sdk/registry';
import { rawSvgAdapter } from './raw-svg-adapter';
import { lucideAdapter } from './lucide-adapter';

export function registerBuiltinAdapters(): void {
  if (!adapterRegistry.get(rawSvgAdapter.descriptor.id)) {
    adapterRegistry.register(rawSvgAdapter);
  }
  if (!adapterRegistry.get(lucideAdapter.descriptor.id)) {
    adapterRegistry.register(lucideAdapter);
  }
}

export { rawSvgAdapter } from './raw-svg-adapter';
export { lucideAdapter } from './lucide-adapter';
