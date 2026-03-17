// Adapter SDK — public API surface.
// Import from '@/lib/import/adapter-sdk' to access all adapter types and the registry.

export type {
  ExternalIconAdapter,
  ExternalIconAdapterCapabilities,
  ExternalIconImportRequest,
  ExternalIconImportResult,
  ExternalIconInputMode,
  ExternalIconProvenance,
  ExternalIconSearchResult,
  ExternalIconSourceDescriptor,
  ExternalIconWarning,
} from './types';

export { ExternalIconImportError } from './types';

export type { ExternalIconAdapterRegistry } from './registry';
export { adapterRegistry, createAdapterRegistry } from './registry';
