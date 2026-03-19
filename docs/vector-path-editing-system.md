# Vector Path Editing System Design (Cubic Bézier-First)

## Scope and Design Goals

This document defines a conceptual and architectural design for a path editor that supports professional-grade cubic Bézier authoring with parity to modern design tools.

Primary goals:

- Single canonical geometry model based on cubic Bézier segments.
- Predictable, reversible editing behavior for anchors and handles.
- Deterministic snapping shared by all editable points.
- Stable behavior across edge cases (degenerate geometry, closure seam, precision limits).
- SVG path compatibility for import/export and interoperability.

---

## 1) Conceptual Data Model

## 1.1 Path Aggregate

A **Path** is an ordered list of anchors with metadata:

- `id`
- `anchors[]` (ordered)
- `closed: boolean`
- optional styling/render metadata (outside scope of geometry logic)

If `closed=true`, logical segment connectivity includes `last -> first`.

## 1.2 Anchor Node

Each **Anchor** includes:

- `id`
- `position` (absolute canvas coordinate)
- `inHandle` (optional vector relative to anchor)
- `outHandle` (optional vector relative to anchor)
- `constraintMode` (exactly one):
  - `FREE`
  - `MIRROR_ANGLE`
  - `MIRROR_ANGLE_LENGTH`

Handle vectors are always stored as **relative vectors** from anchor origin (not absolute points).

## 1.3 Segment Derivation

Each segment from anchor `A(i)` to `A(i+1)` is represented as cubic Bézier:

- `P0 = A(i).position`
- `P1 = P0 + A(i).outHandle` (or `P0` if missing)
- `P3 = A(i+1).position`
- `P2 = P3 + A(i+1).inHandle` (or `P3` if missing)

Thus missing handles are equivalent to zero vectors for segment construction.

## 1.4 Editing State Model

Separate immutable/document geometry from transient editing state:

- **Document model**: authoritative anchors/handles/constraints.
- **Interaction session state**: active tool, drag origin, modifier keys, snap candidates, hover target, selection set.
- **Derived cache**: tessellation, bounds, hit proxies, acceleration structures.

This separation keeps undo/redo precise and interaction latency low.

---

## 2) Constraint System Behavior

Each anchor enforces exactly one mode.

## 2.1 Free

- `inHandle` and `outHandle` are independent.
- Dragging one handle does not alter the opposite handle.

## 2.2 Mirror Angle

- Handles must remain collinear and opposite in direction.
- Lengths may differ.
- If one handle is moved, opposite handle direction is recomputed to be antiparallel; its magnitude is preserved.

## 2.3 Mirror Angle and Length

- Full symmetry about anchor.
- Opposite handle is exact negation of moved handle vector.
- Direction and magnitude are always mirrored.

## 2.4 Constraint Transitions

### Mirrored → Free

- Keep both existing handle vectors exactly as-is.
- Only stop future coupled updates.
- No recomputation or normalization beyond internal numeric cleanup.

### Free → Mirror Angle

- Pick a dominant reference handle (edited handle this session; else non-zero handle; else default axis).
- Force opposite handle direction antiparallel to reference.
- Preserve both current magnitudes when possible.

### Free → Mirror Angle + Length

- Same direction coupling as above.
- Set opposite magnitude to match reference magnitude.
- If both handles exist with conflicting magnitudes, prefer active/last-edited handle as source of truth.

Continuity principle: constraints should alter the minimum necessary degrees of freedom.

---

## 3) Interaction Logic

## 3.1 Selection and Hit Priority

Hit-test priority is deterministic:

1. handle
2. anchor
3. segment

If multiple candidates of same class overlap, break ties by smallest screen-space distance, then stable document order.

## 3.2 Dragging an Anchor

On anchor drag:

- Update anchor absolute position.
- Translate existing `inHandle` and `outHandle` endpoints by same delta implicitly by keeping relative vectors unchanged.
- Adjacent segments update from derived geometry.

This preserves local curve shape around the moved anchor.

## 3.3 Dragging a Handle

On handle drag:

1. Compute proposed new handle vector from dragged endpoint to anchor.
2. Run snapping pipeline (same system as anchors).
3. Apply snapped vector to dragged handle.
4. Enforce opposite-handle update based on constraint mode.
5. Recompute dependent segment caches.

## 3.4 Dynamic Handle Creation

When initiating curve edit on an anchor with missing handle(s):

- Create relevant handle vector from drag gesture.
- If in mirrored mode and opposite handle missing, instantiate opposite per mode constraints.
- If in free mode, only create the manipulated side.

Anchors may legally remain with one or zero handles.

## 3.5 Corner/Smooth Switching

- **Corner** maps to `FREE`.
- **Smooth** maps to mirrored mode (`MIRROR_ANGLE` or full mirror per product decision).

Switch action should preserve visible curve as much as possible via minimum-change recomputation.

---

## 4) Unified Snapping Model

Handles and anchors must use a shared snap engine and policies.

## 4.1 Snap Inputs

Given candidate point `C` (anchor position or handle endpoint), evaluate against:

- Grid
- Other anchors
- Guides
- Alignment axes

For handles, this occurs on endpoint coordinates; stored result converts back to relative vector.

## 4.2 Angle Snapping

With modifier active:

- Quantize handle direction angle to fixed increments (e.g., 45°).
- Magnitude remains from cursor distance unless a positional snap target wins by priority policy.

## 4.3 Conflict Resolution (Deterministic)

When multiple targets are valid:

1. highest snap class priority (configurable, but shared by anchors/handles)
2. smallest distance within tolerance
3. stable tie-breaker (target id ordering)

Determinism avoids jitter between frames.

## 4.4 Hysteresis and Stability

Use snap hysteresis to prevent flicker near boundaries:

- Maintain current snap lock until cursor exceeds release threshold.
- Reacquire only when a competing target exceeds lock by margin.

Apply identical thresholds for handle and anchor snapping unless explicitly configured otherwise (default identical).

---

## 5) Normalization Strategy (Cubic-Only Internal Form)

## 5.1 Canonical Internal Form

Internally store all segments as cubic Bézier derivations between anchors.

## 5.2 Straight Lines

Represent lines as degenerate cubics:

- control points on endpoints (or collinear zero-length handles), yielding linear interpolation.

## 5.3 Arc/Primitive Conversion

On import or primitive authoring:

- Convert arcs, quadratics, and shorthand commands into cubic equivalents.
- Preserve source semantic metadata only as optional annotations; geometry pipeline operates on cubic form.

## 5.4 SVG Compatibility

- Input parser accepts SVG path semantics.
- Exporter can emit canonical cubic commands (`C`) and closures (`Z`).
- Optional pretty-printing may reintroduce shorthand for readability only if lossless.

---

## 6) Geometry and Continuity Rules

- Smooth continuity at anchor requires collinear in/out handles.
- Zero-length handle equals no directional curvature contribution.
- Missing handle treated as zero-length for segment computation.
- Handle vectors may cross through anchor (negative projection relative to intuitive side), and remain valid.

Practical continuity classes:

- **Corner**: no continuity constraints.
- **Tangent smooth (G1-like)**: mirror angle.
- **Symmetric smooth**: mirror angle + length.

---

## 7) Closed Path Behavior

For `closed=true`:

- Connectivity includes seam segment `last -> first`.
- Constraint evaluation at first and last anchors is identical to interior anchors.
- Editing either seam-adjacent segment must update continuity without special-case geometry branches beyond index wrapping.

Use modular index utilities so seam logic is not duplicated.

---

## 8) Transform Behavior

All transforms operate on anchor positions and handle endpoint positions under same affine transform.

Because handles are stored as relative vectors:

1. transform anchor absolute position,
2. transform handle absolute endpoint,
3. recompute relative vector = transformedEndpoint - transformedAnchor.

This preserves shape under:

- scale (uniform/non-uniform)
- rotate
- flip/reflection

For mirrored constraints, transform does not force mode changes; constraints remain as logical relationships for future edits.

---

## 9) Performance Architecture

## 9.1 Multi-Layer Geometry Cache

Maintain caches keyed by path revision:

- segment bounding boxes
- flattened/tessellated polylines for rendering
- hit-test acceleration structures (e.g., spatial index over anchors/handles/segments)

## 9.2 Incremental Invalidation

On edit, invalidate only affected neighborhood:

- moving anchor i affects segments `(i-1, i)` and `(i, i+1)` (plus seam equivalents if closed).
- moving handle affects one adjacent segment.

Rebuild full path caches only for global transforms or topology edits.

## 9.3 Approximation Strategy

Use adaptive curve approximation tolerance based on zoom:

- coarse tessellation for far zoom (performance)
- finer tessellation when zoomed in (interaction fidelity)

Hit-testing should use analytic distance where practical, falling back to tessellation with bounded error.

---

## 10) Edge Case Handling Principles

1. **Zero-Length Handles**
   - Treat as degenerate controls; resulting segment behaves straight where both controls collapse appropriately.

2. **Single-Sided Handles**
   - Missing side defaults to zero vector; continuity still defined by existing side and adjacent segment geometry.

3. **Constraint Breaking (mirrored → free)**
   - Preserve exact current vectors; no forced rebalancing.

4. **Constraint Enforcement (free → mirrored)**
   - Apply minimum-change adjustment using active handle precedence, preserving segment continuity where possible.

5. **Overlapping Anchors**
   - Allow overlap by default (no implicit merge) to avoid destructive edits; optional explicit merge action can exist separately.

6. **Degenerate Segments (same endpoints)**
   - Keep editable/renderable as legal degenerate cubics; avoid divide-by-zero assumptions in length/normal calculations.

7. **Closed Path Seam**
   - Use wrapped indices and identical constraint logic across seam.

8. **Self-Intersection**
   - Permit without validation errors; rendering and hit-testing must support non-simple paths.

9. **Extreme Handle Lengths**
   - Support large coordinates with viewport-space clamping only in interaction UI, not document data.

10. **Numerical Stability**
   - Use epsilon-based comparisons for collinearity, zero length, and snap tie decisions.
   - Quantize displayed values (not stored precision) to reduce visible jitter.

11. **Snapping Conflicts**
   - Resolve via deterministic priority + distance + stable tie-break.

12. **Transform Edge Cases**
   - Non-uniform scale transforms handle vectors via full affine mapping.
   - Flips preserve curve geometry by transformed endpoints; logical in/out roles remain tied to path direction.

13. **Handle Crossing Anchor**
   - Valid geometry; constraint logic uses vectors, not side assumptions.

14. **Path Direction Reversal**
   - Reverse anchor order and swap per-anchor `inHandle <-> outHandle`.
   - Preserve constraint mode values and recompute derived segments.

---

## 11) Recommended System Components

- **Path Document Store**: persistent model + undo/redo events.
- **Geometry Engine**: cubic derivation, continuity checks, transforms, reversal.
- **Constraint Solver**: anchor-local enforcement for handle coupling modes.
- **Snap Engine**: shared anchor/handle target evaluation and deterministic resolution.
- **Interaction Controller**: pointer/keyboard gesture lifecycle, modifier handling, hit priority.
- **Render Adapter**: curve drawing + control gizmos + cached approximation.
- **Validation/Diagnostics Layer**: reports degenerate but legal conditions without blocking editing.

A clean modular split makes behavior testable and allows parity-level UX without framework lock-in.

## 12) Behavioral Invariants (Testable)

Core invariants to assert in system-level tests:

- Every segment resolves to cubic control tuple `(P0,P1,P2,P3)`.
- Handle vectors remain relative to anchor after any operation.
- Constraint mode is singular per anchor and enforced after each mutation.
- Anchor/handle snapping produces identical outcomes for identical candidate points and targets.
- Closed paths preserve seam connectivity and continuity under edits and transforms.
- Path reversal swaps in/out handles correctly and preserves rendered shape.

These invariants provide a reliable baseline for tool parity with professional vector editors.
