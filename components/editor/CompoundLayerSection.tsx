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
import { cn } from '@/lib/utils';

type Props = {
  layer: Layer;
  onFlatten: () => void;
  onConvertToGroup: () => void;
  /**
   * W2-3 operand-edit hook. Fires when an operand leaf in the
   * tree is activated. The parent (InspectorPanel) wires this to
   * the path-editor selection or to a future operand-edit modal.
   * Optional — when absent, leaves render non-interactive so
   * read-only consumers (Storybook, tests) still mount cleanly.
   */
  onOperandSelect?: (operandId: string) => void;
  /**
   * Operand id currently highlighted. The W2-3 contract is
   * "clicking an operand selects it"; the parent passes the
   * selected id back so the visual selection survives re-renders
   * and matches the editor's authoritative selection state.
   */
  selectedOperandId?: string | null;
};

/**
 * Render a compound expression tree as indented text. Leaf nodes
 * are clickable when `onOperandSelect` is provided, mirroring the
 * W2-3 contract that operand selection routes through the parent's
 * selection state. Operand ids appear as `op{n}` (the trailing
 * segment of the canonical `${layerId}/op{n}` id); the full id is
 * in the title attribute for accessibility / debugging.
 */
function renderTree(
  node: CompoundNode,
  depth: number,
  onOperandSelect: ((operandId: string) => void) | undefined,
  selectedOperandId: string | null | undefined,
): React.ReactNode {
  const indent = depth * 12;
  if (node.kind === 'leaf') {
    const shortId = node.operandId.split('/').pop() ?? node.operandId;
    const isSelected = selectedOperandId === node.operandId;
    const interactive = Boolean(onOperandSelect);
    if (!interactive) {
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
      <button
        key={`leaf:${node.operandId}:${depth}`}
        type="button"
        style={{ paddingLeft: indent }}
        title={node.operandId}
        aria-label={`Select operand ${shortId}`}
        aria-pressed={isSelected}
        onClick={() => onOperandSelect!(node.operandId)}
        className={cn(
          'flex w-full items-center gap-1 rounded-sm px-1 py-0.5 text-left text-xs font-mono transition-colors',
          isSelected
            ? 'bg-accent/40 text-accent-foreground'
            : 'text-muted-foreground hover:bg-accent/20 hover:text-foreground',
        )}
      >
        <span aria-hidden>•</span>
        <span>{shortId}</span>
      </button>
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
          <div key={i}>{renderTree(child, depth + 1, onOperandSelect, selectedOperandId)}</div>
        ))}
      </div>
    </div>
  );
}

export function CompoundLayerSection({
  layer,
  onFlatten,
  onConvertToGroup,
  onOperandSelect,
  selectedOperandId,
}: Props) {
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
        {renderTree(compound.tree, 0, onOperandSelect, selectedOperandId)}
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
