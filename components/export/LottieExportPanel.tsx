'use client';

/**
 * M7 — Lottie export panel in the editor's export sidebar.
 * M8 — lottie-web preview canvas (lazy-loaded, feature-flagged).
 *
 * Shows: format selector, downgrade warnings, preview canvas, download button.
 */

import { Icon as UiIcon } from '@hiero/ui-icons';
import { useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ds/tag';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { useEditorStore } from '@/lib/editor-store/hooks';
import { exportLottie, type LottieExportOptions } from '@/lib/export/export-lottie';
import {
  collectLottieDowngrades,
  type LottieDowngradeDiagnostic,
} from '@/lib/export/lottie-downgrade';
import type { Icon } from '@/lib/schema/types';

// ---------------------------------------------------------------------------
// Feature flag for lottie-web preview (M8)
// ---------------------------------------------------------------------------

const LOTTIE_PREVIEW_ENABLED =
  typeof process !== 'undefined' &&
  process.env?.NEXT_PUBLIC_LOTTIE_PREVIEW_ENABLED === 'true';

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function LottieExportPanel() {
  const project = useEditorStore((s) => s.project);
  const selectedIcon = useEditorStore((s) => s.currentIconId);
  const selectedVariant = useEditorStore((s) => s.currentVariantId);

  const [morphQuality, setMorphQuality] = useState<LottieExportOptions['morphQuality']>('medium');
  const [fps, setFps] = useState(60);
  const [isExporting, setIsExporting] = useState(false);

  // Resolve the icon from the project
  const icon: Icon | null = useMemo(() => {
    if (!project || !selectedIcon) return null;
    const iconSet = project as { icons?: Record<string, Icon> };
    return iconSet.icons?.[selectedIcon] ?? null;
  }, [project, selectedIcon]);

  const variantId = selectedVariant ?? Object.keys(icon?.variants ?? {})[0] ?? '';

  // Collect downgrade diagnostics
  const diagnostics = useMemo(() => {
    if (!icon || !variantId) return [];
    return collectLottieDowngrades(icon, variantId);
  }, [icon, variantId]);

  // Export handler
  const handleExport = useCallback(() => {
    if (!icon || !variantId) return;
    setIsExporting(true);

    try {
      const lottieJson = exportLottie(icon, variantId, { fps, morphQuality });
      const jsonString = JSON.stringify(lottieJson, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${icon.name ?? icon.id}-${variantId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Lottie export failed:', err);
      toast({
        title: 'Lottie export failed',
        description: err instanceof Error ? err.message : 'Unexpected error during export.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  }, [icon, variantId, fps, morphQuality]);

  if (!icon) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 px-4 py-5 text-center">
        <p className="text-sm text-muted-foreground">Select an icon to export as Lottie.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UiIcon name="file-json" size={16} className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Lottie Export</p>
        </div>
        <Tag variant="muted">Lottie 5.x</Tag>
      </div>

      {/* Export options */}
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1.5">
          <Label className="text-xs">FPS</Label>
          <Select value={String(fps)} onValueChange={(v) => setFps(Number(v))}>
            <SelectTrigger size="pane">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24">24 fps</SelectItem>
              <SelectItem value="30">30 fps</SelectItem>
              <SelectItem value="60">60 fps</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Morph Quality</Label>
          <Select
            value={morphQuality}
            onValueChange={(v) =>
              setMorphQuality(v as LottieExportOptions['morphQuality'])
            }
          >
            <SelectTrigger size="pane">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low (5 steps)</SelectItem>
              <SelectItem value="medium">Medium (10 steps)</SelectItem>
              <SelectItem value="high">High (30 steps)</SelectItem>
              <SelectItem value="max">Max (60 steps)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* M8 — Lottie preview (feature-flagged) */}
      {LOTTIE_PREVIEW_ENABLED && (
        <LottiePreview icon={icon} variantId={variantId} fps={fps} morphQuality={morphQuality} />
      )}

      {/* Downgrade warnings (M7/M10) */}
      {diagnostics.length > 0 && (
        <div className="grid gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Compatibility Notes</p>
          {diagnostics.map((d, i) => (
            <DowngradeBadge key={i} diagnostic={d} />
          ))}
        </div>
      )}

      {/* Export button */}
      <Button
        className="w-full gap-2"
        onClick={handleExport}
        disabled={isExporting || !variantId}
      >
        <UiIcon name="download" size={16} className="size-4" />
        {isExporting ? 'Exporting...' : 'Download Lottie JSON'}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Downgrade badge component
// ---------------------------------------------------------------------------

function DowngradeBadge({ diagnostic }: { diagnostic: LottieDowngradeDiagnostic }) {
  const icon =
    diagnostic.severity === 'warning' ? (
      <UiIcon name="alert-triangle" size={12} className="size-3 text-amber-500" />
    ) : (
      <UiIcon name="info" size={12} className="size-3 text-blue-500" />
    );

  return (
    <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/30 px-2.5 py-1.5">
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-foreground">{diagnostic.feature}</p>
        <p className="text-[10px] text-muted-foreground">{diagnostic.fallback}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// M8 — Lottie-web preview (lazy-loaded, canvas 128×128)
// ---------------------------------------------------------------------------

function LottiePreview({
  icon,
  variantId,
  fps,
  morphQuality,
}: {
  icon: Icon;
  variantId: string;
  fps: number;
  morphQuality: LottieExportOptions['morphQuality'];
}) {
  const [previewError, setPreviewError] = useState<string | null>(null);
  const containerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;

      // Lazy-load lottie-web and render preview
      (async () => {
        try {
          const lottieModule = await import('lottie-web');
          const lottie = lottieModule.default ?? lottieModule;

          // Clear previous content
          node.innerHTML = '';

          const lottieJson = exportLottie(icon, variantId, { fps, morphQuality });

          lottie.loadAnimation({
            container: node,
            renderer: 'canvas',
            loop: true,
            autoplay: true,
            animationData: lottieJson,
          });
          setPreviewError(null);
        } catch (err) {
          setPreviewError(err instanceof Error ? err.message : 'Preview failed');
        }
      })();
    },
    [icon, variantId, fps, morphQuality],
  );

  if (previewError) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-border/50 bg-muted/20">
        <p className="text-xs text-muted-foreground">{previewError}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mx-auto size-32 rounded-lg border border-border/50 bg-muted/20"
    />
  );
}
