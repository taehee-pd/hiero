/**
 * Built-in adapter registrations.
 *
 * Import this module at app init time to register all built-in adapters
 * with the shared adapter registry.
 */

import { adapterRegistry } from '../adapter-sdk/registry';
import { rawSvgAdapter } from './raw-svg-adapter';
import { lucideAdapter } from './lucide-adapter';
import { heroiconsAdapter } from './heroicons-adapter';
import { phosphorAdapter } from './phosphor-adapter';
import { materialSymbolsAdapter } from './material-symbols-adapter';

export function registerBuiltinAdapters(): void {
  const adapters = [
    rawSvgAdapter,
    lucideAdapter,
    heroiconsAdapter,
    phosphorAdapter,
    materialSymbolsAdapter,
  ];
  for (const adapter of adapters) {
    if (!adapterRegistry.get(adapter.descriptor.id)) {
      adapterRegistry.register(adapter);
    }
  }
}

export { rawSvgAdapter } from './raw-svg-adapter';
export { lucideAdapter } from './lucide-adapter';
export { heroiconsAdapter } from './heroicons-adapter';
export { phosphorAdapter } from './phosphor-adapter';
export { materialSymbolsAdapter } from './material-symbols-adapter';
