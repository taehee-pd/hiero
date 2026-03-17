/**
 * External Icon Adapter SDK — stable public interface for icon source adapters.
 *
 * Every adapter normalises an external source (icon library, raw SVG paste,
 * file upload) into a common intermediate representation that the downstream
 * sanitisation → normalisation → schema-conversion pipeline can consume
 * without any adapter-specific knowledge.
 *
 * Adapters MUST NOT produce internal schema types (Layer, Icon, etc.) directly.
 * They return raw SVG content plus provenance metadata; the pipeline handles
 * the rest.
 */

// ---------------------------------------------------------------------------
// Input mode discriminator
// ---------------------------------------------------------------------------

/**
 * The three canonical ways an icon can enter the system.
 * An adapter declares which modes it supports via `capabilities`.
 */
export type ExternalIconInputMode = 'library-icon-name' | 'raw-svg-string' | 'svg-file';

// ---------------------------------------------------------------------------
// Adapter capabilities
// ---------------------------------------------------------------------------

/**
 * Static metadata that the registry and UI use to decide which adapters to
 * offer and how to present them.  Returned once from `descriptor` — adapters
 * should treat this as immutable after registration.
 */
export type ExternalIconAdapterCapabilities = {
  /** Which input modes this adapter can handle. At least one required. */
  inputModes: [ExternalIconInputMode, ...ExternalIconInputMode[]];
  /** Adapter supports `search()` for browsable icon discovery. */
  searchable: boolean;
  /** Human-readable label for the UI (e.g. "Lucide Icons"). */
  displayName: string;
  /** Optional icon library version string for provenance. */
  libraryVersion?: string;
  /** SPDX license identifier if the source has a known license. */
  license?: string;
};

// ---------------------------------------------------------------------------
// Source descriptor
// ---------------------------------------------------------------------------

/**
 * Static identity of an adapter. Used by the registry for resolution and by
 * the UI for rendering the adapter picker.
 */
export type ExternalIconSourceDescriptor = {
  /** Unique, kebab-case adapter id (e.g. "lucide", "raw-svg"). */
  id: string;
  capabilities: ExternalIconAdapterCapabilities;
};

// ---------------------------------------------------------------------------
// Import request (adapter input)
// ---------------------------------------------------------------------------

/**
 * Discriminated union that represents every supported way to request an icon
 * from an adapter. Exactly one variant is populated per call.
 */
export type ExternalIconImportRequest =
  | {
      mode: 'library-icon-name';
      /** The library-specific icon identifier (e.g. "arrow-right"). */
      iconId: string;
      /** Optional display name override; adapter may supply a default. */
      name?: string;
    }
  | {
      mode: 'raw-svg-string';
      /** Raw SVG markup provided by the user. */
      svgContent: string;
      /** Optional display name for the resulting icon. */
      name?: string;
    }
  | {
      mode: 'svg-file';
      /** The uploaded File object. */
      file: File;
      /** Optional display name override; defaults to filename. */
      name?: string;
    };

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

/**
 * Captures where an imported icon came from so the system can display
 * attribution, detect duplicates, and support re-import workflows.
 *
 * Stored on the `Icon` after schema conversion — not on individual layers
 * (layer-level source tracking uses the existing `SvgImportLayerMeta`).
 */
export type ExternalIconProvenance = {
  /** The adapter id that produced this result. */
  adapterId: string;
  /** Human-readable library name (e.g. "Lucide"). */
  sourceLibrary?: string;
  /** Library version at import time. */
  sourceVersion?: string;
  /** Library-specific icon identifier. */
  sourceIconId?: string;
  /** SPDX license identifier. */
  sourceLicense?: string;
  /** ISO-8601 timestamp when the import was performed. */
  importedAt: string;
};

// ---------------------------------------------------------------------------
// Warnings and errors
// ---------------------------------------------------------------------------

/**
 * Non-fatal issue encountered during adapter fetch.  Warnings propagate
 * through the pipeline into the ImportReport the user sees before confirming.
 *
 * Adapters MUST surface any loss of fidelity — silent data loss is a bug.
 */
export type ExternalIconWarning = {
  /** Machine-readable warning code for programmatic handling. */
  code: string;
  /** Human-readable description for the import report UI. */
  message: string;
  /** Optional reference to the element or attribute that triggered the warning. */
  context?: string;
};

/**
 * Fatal failure during adapter fetch.  The pipeline will not proceed.
 *
 * Use a plain `Error` subclass so callers can `instanceof`-check and the
 * stack trace is preserved.
 */
export class ExternalIconImportError extends Error {
  /** Machine-readable error code. */
  readonly code: string;
  /** The adapter that produced the error. */
  readonly adapterId: string;
  /** The request that caused the error, if available. */
  readonly request?: ExternalIconImportRequest;
  /** The underlying error, if any. */
  readonly cause?: unknown;

  constructor(options: {
    code: string;
    message: string;
    adapterId: string;
    request?: ExternalIconImportRequest;
    cause?: unknown;
  }) {
    super(options.message);
    this.name = 'ExternalIconImportError';
    this.code = options.code;
    this.adapterId = options.adapterId;
    this.request = options.request;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

// ---------------------------------------------------------------------------
// Import result (adapter output)
// ---------------------------------------------------------------------------

/**
 * The normalised intermediate representation that every adapter returns.
 *
 * This is the **sole contract** between adapters and the downstream pipeline.
 * It deliberately contains raw SVG content (not parsed layers) so that
 * sanitisation and normalisation boundaries are never bypassed.
 */
export type ExternalIconImportResult = {
  /** Raw SVG markup. Pipeline will sanitise and normalise this. */
  svgContent: string;
  /** Suggested display name for the icon. */
  suggestedName: string;
  /** Suggested tags for the icon (from library metadata, if available). */
  suggestedTags?: string[];
  /** Provenance metadata attached to the resulting Icon. */
  provenance: ExternalIconProvenance;
  /** Non-fatal issues the user should review before confirming import. */
  warnings: ExternalIconWarning[];
};

// ---------------------------------------------------------------------------
// Search result (for browsable adapters)
// ---------------------------------------------------------------------------

/**
 * A single entry from a library search.  The UI renders these as a picker
 * list; selecting one creates a `library-icon-name` import request.
 */
export type ExternalIconSearchResult = {
  /** Library-specific icon identifier. */
  iconId: string;
  /** Human-readable display name. */
  name: string;
  /** Optional search tags / aliases. */
  tags?: string[];
  /** Optional lightweight SVG preview for thumbnails. */
  previewSvg?: string;
};

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

/**
 * The stable contract every external icon adapter must implement.
 *
 * Adapters are stateless — any configuration lives in the descriptor or is
 * passed via the request.  The registry owns adapter lifecycle.
 *
 * Implementation guide:
 *   1. Return a static `descriptor` with a unique id and capabilities.
 *   2. Implement `fetch()` for every input mode listed in capabilities.
 *   3. Optionally implement `search()` if `capabilities.searchable` is true.
 *   4. Never produce internal schema types — return raw SVG + provenance.
 *   5. Surface any fidelity loss as warnings, never silently drop content.
 */
export interface ExternalIconAdapter {
  /** Static identity and capability metadata. */
  readonly descriptor: ExternalIconSourceDescriptor;

  /**
   * Fetch a single icon from the source.
   *
   * The adapter resolves the request into raw SVG content plus metadata.
   * It MUST reject unsupported input modes with `ExternalIconImportError`.
   */
  fetch(request: ExternalIconImportRequest): Promise<ExternalIconImportResult>;

  /**
   * Search or browse available icons (only required when
   * `descriptor.capabilities.searchable` is `true`).
   *
   * Implementations should return results quickly — callers may invoke this
   * on every keystroke with debounce.
   */
  search?(query: string, options?: { limit?: number }): Promise<ExternalIconSearchResult[]>;
}
