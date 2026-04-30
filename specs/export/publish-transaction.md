# Publish Transaction

**Status:** Reviewed
**Primary files:** `lib/sync-service/publish-transaction.ts`, `lib/sync-service/version-snapshot.ts`, `components/export/publish/PublishDialog.tsx`, `lib/sync-service/metadata.ts`

## Overview

The **Publish Transaction** is the single user-facing operation that ships an icon set as a versioned release. It unifies the prior `PublishPanel` and `ReleasePanel` surfaces — both removed in Phase 2 — into one transactional flow.

The Hiero Self-Hosted Studio Spec Sheet defines Publish as a five-step contract:

```text
1. validate the current draft
2. compute change summary
3. ask for version + release notes
4. execute one or more release targets
5. record a version snapshot
```

This spec describes the orchestrator (`executePublishTransaction`), the dialog UI (`PublishDialog`), and the PR-body enrichment that makes the resulting GitHub PR review-friendly.

## Goals

- One Publish CTA in the studio chrome — no second publish surface
- Per-target success/failure is recorded and surfaced
- A `VersionSnapshot` is created whenever **any** target succeeds — partial failure stays visible in history
- Generated PRs include human-readable change context **and** a machine-readable JSON metadata block

## Non-Goals

- No two-phase commit across remotes — the orchestrator never claims atomicity it can't deliver
- No automatic retry on failed targets — user retries from the dialog
- No scheduled publishing, role-based approvals, branch-aware environments (per spec §Non-Goals)

## Orchestrator

```typescript
type PublishTransactionInput = {
  version: string;
  releaseNotes: string;
  publishedBy: string;
  workspace: Workspace;
  changesSummary: ChangesSummary;
  targets: PublishTargetSpec[];
};

type TargetExecutor = (
  spec: PublishTargetSpec,
) => Promise<
  | { status: 'success'; url?: string }
  | { status: 'failed'; error: string; url?: string }
>;

type PublishOutcome =
  | { kind: 'success'; snapshot: VersionSnapshot }
  | { kind: 'partial-failure'; snapshot: VersionSnapshot; failedTargets: TargetResult[] }
  | { kind: 'all-failed'; targetResults: TargetResult[] };

async function executePublishTransaction(
  input: PublishTransactionInput,
  options: { execute: TargetExecutor; persistence: PersistenceAdapter; now?: () => Date; generateId?: () => string },
): Promise<PublishOutcome>;
```

## Outcome rules

| Per-target results | Outcome | Snapshot persisted |
|---|---|---|
| All success | `success` | yes |
| Mixed success + fail | `partial-failure` | yes |
| All fail | `all-failed` | **no** |
| Empty target list | `all-failed` | no |

## Transport boundary

The orchestrator is **transport-agnostic** by design. It does **not** import `sync-pr.ts` or `npm-publish-client.ts`. Per-target wiring happens at the call site (PublishDialog or higher), which gives tests a clean unit boundary and keeps the bundle graph from importing server-only code into the studio.

```text
┌──────────────────┐    ┌──────────────────────────┐    ┌────────────────────┐
│ PublishDialog    │───▶│ executePublishTransaction│───▶│ PersistenceAdapter │
│ (UI)             │    │ (pure orchestration)     │    │ saveVersionSnapshot│
└────────┬─────────┘    └──────────┬───────────────┘    └────────────────────┘
         │                         │
         │                         ▼
         │                  TargetExecutor (caller-supplied)
         │                         │
         ├──── git-pr     ─────► sync-pr.syncPr
         ├──── npm        ─────► npm-publish-client.publishPackage
         └──── local-dir  ─────► fs.writeFile (host repo)
```

## PublishDialog

Single dialog, three phases:

```text
compose ─Publish▶ publishing ─done▶ done
   ▲                                  │
   └──Reset on close──────────────────┘
```

### Compose phase

- **Version field** — pre-filled with `suggestedVersion` (caller-provided). Three bump buttons (`patch`/`minor`/`major`) call `bumpSemver(v, kind)` from `publish-transaction.ts`.
- **Release notes** — multi-line `<Textarea>`, optional. Empty content omits the "Release notes" section from the PR body.
- **Targets checklist** — derived from `targetOptions` prop; user toggles which to run.
- **Change summary** — three Tags (`added`/`modified`/`removed`) sourced from `changesSummary`. Renders "no source changes detected" when total is zero.

### Done phase

For each target the dialog renders a `StatusBadge` (`success`/`failed`), the kind label, an `open` link if a URL is available, and the error string for failures.

After a successful or partial outcome the editor store records the publish via `markPublished(version)` so the navbar badge transitions to `'published'` (see `specs/ui/save-state-taxonomy.md`).

## PR body enrichment

`generatePrBody` in `lib/sync-service/metadata.ts` accepts three new optional fields when called from the publish path: `version`, `releaseNotes`, and `targetResults`. The body now contains:

1. Header line with optional release version
2. **Release notes** blockquote (only when non-empty)
3. Existing icon-change summary table (unchanged)
4. Existing file-detail collapsible section (unchanged)
5. Existing validation checklist (unchanged)
6. **Publish targets** section with status icons + URLs
7. **Machine-readable metadata block** — fenced JSON tagged with `<!-- hiero:metadata:start --> ... <!-- hiero:metadata:end -->` for bots and CI parsers

```jsonc
{
  "schema": "hiero.pr.metadata/v1",
  "version": "1.2.0",
  "actor": "taehee",
  "counts": { "iconsChanged": 3, "filesAdded": 9, "filesUpdated": 2, "filesDeleted": 0 },
  "iconChanges": [{ "iconDir": "icon-play", "kind": "added" }],
  "targetResults": [
    { "kind": "git-pr", "status": "success", "url": "https://github.com/.../pull/42" }
  ]
}
```

The block is always emitted, even with no enrichment options — Phase 2 changes are additive and existing call sites get the same body shape they had before, plus the metadata tail.

## Test contract

- `tests/publish-transaction.test.ts` — outcome matrix (success / partial / all-fail / empty list), target order preserved, sourceHash determinism, per-target error capture
- `tests/pr-body-enrichment.test.ts` — metadata block always present, version/releaseNotes/targetResults are additive, JSON parses out clean
- `tests/metadata-generators.test.ts` — pre-existing tests still pass (regression contract)

## Open future work

- Cancel during publish — current `publishing` phase has no cancel button
- Per-target progress (X / N targets running) instead of single "Publishing v1.2.0…"
- Dry-run mode — preview the change summary + PR body without firing transports

## Related specs

- `specs/schema/version-snapshot.md` — record shape for the publish result
- `specs/schema/install-config.md` — release target configuration
- `specs/export/repo-native-distribution.md` — the broader two-lane model this fits into
