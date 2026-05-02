'use client';

/**
 * Inspector affordance for a compound layer (W2-3).
 *
 * Shows the operand tree in collapsed form and exposes the two
 * destructive-but-recoverable actions: `Convert to group` (primary,
 * non-destructive — explodes operands into sibling layers) and
 * `Flatten` (destructive — drops the operand tree, keeps `path.d`).
 *
 * The Flatten action prompts via a confirmation dialog per
 * `docs_canonical/ICON_TRANSITION_UX_PLAN.md` §5.3.
 */
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { compoundOpGlyph, operandIdsInTree, rootOpGlyph } from '@/lib/schema/compound';
import type { CompoundNode, Layer } from '@/lib/schema/types';

type Props = {
  layer: Layer;
  onFlatten: () => void;
  onConvertToGroup: () => void;
};

/**
 * Render a compound expression tree as indented text. Operand ids
 * appear as `op{n}` (the trailing segment of the canonical
 * `${layerId}/op{n}` id). The full id is in the title attribute for
 * accessibility / debugging.
 */
function renderTree(node: CompoundNode, depth = 0): React.ReactNode {
  const indent = depth * 12;
  if (node.kind === 'leaf') {
    const shortId = node.operandId.split('/').pop() ?? node.operandId;
    return (
      <div
        key={`leaf:${node.operandId}:${depth}`}
        style={{ paddingLeft: indent }}
        title={node.operandId}
        className="flex items-center gap-1 text-xs font-mono text-muted-foreground"
      >
        <span aria-hidden>•</span>
        <span>{shortId}</span>
      </div>
    );
  }
  return (
    <div key={`op:${depth}:${node.op}`} style={{ paddingLeft: indent }}>
      <div className="flex items-center gap-1 text-xs font-mono text-foreground">
        <span aria-hidden className="text-base leading-none">
          {compoundOpGlyph(node.op)}
        </span>
        <span>{node.op}</span>
      </div>
      <div>
        {node.children.map((child, i) => (
          <div key={i}>{renderTree(child, depth + 1)}</div>
        ))}
      </div>
    </div>
  );
}

export function CompoundLayerSection({ layer, onFlatten, onConvertToGroup }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const compound = layer.compound;
  const operandIds = useMemo(
    () => (compound ? operandIdsInTree(compound.tree) : []),
    [compound],
  );
  if (!compound) return null;

  const opSummary = rootOpGlyph(compound) ?? '';
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Compound
          </h3>
          {opSummary ? (
            <span
              aria-label="Outermost boolean operation"
              className="text-sm leading-none text-muted-foreground"
            >
              {opSummary}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {operandIds.length} operand{operandIds.length === 1 ? '' : 's'} —
          edit the path to flatten, or use the actions below.
        </p>
      </div>

      <div className="rounded-md border border-border/60 bg-background/40 p-2">
        {renderTree(compound.tree)}
      </div>

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          size="sm"
          variant="default"
          onClick={onConvertToGroup}
        >
          Convert to group
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setConfirmOpen(true)}
        >
          Flatten…
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Flatten this compound?</AlertDialogTitle>
            <AlertDialogDescription>
              Flattening replaces the operand tree with the rendered
              path. You won&rsquo;t be able to re-enter operand-edit mode.
              Use <strong>Convert to group</strong> if you want each
              operand back as its own layer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep compound</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                onFlatten();
              }}
            >
              Flatten anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
