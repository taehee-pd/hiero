# Hiero UI Icons — Migration + Edit/Publish Plan

**Created:** 2026-04-27  
**Owner:** Hiero core  
**Status:** proposed (execution-ready)

This plan operationalizes two goals:

1. Migrate all icons used by the Hiero app to Hiero-authored icons (dogfooding).
2. Keep a dedicated in-repo project that designers can edit and publish to this app immediately.

It builds on the accepted decisions in `docs_canonical/hiero-ui-icons/DECISIONS.md` and assumes the current workspace package `packages/hiero-ui-icons/` remains the distribution boundary.

---

## 1) Migration plan: "used icons" → Hiero icons

## Success criteria

- 100% of UI icon usage in app surfaces resolves through `@hiero/ui-icons`.
- No direct `lucide-react` imports in app UI code.
- `packages/hiero-ui-icons/source/icons.json` remains the single source of truth.
- CI determinism gate stays green (`pnpm icons:verify`).

## Phases

### Phase A — Baseline + freeze

- Re-run inventory and capture current icon usage set from app code.
- Freeze icon naming contract (`IconName`) for migration window.
- Confirm alias mapping (e.g., `ChevronDownIcon` → `chevronDown`) in registry generation.

### Phase B — Source normalization

- Ensure every currently used icon exists in `source/manifest.json`.
- Re-seed `source/icons.json` from manifest (`pnpm icons:import`).
- Build generated package outputs (`pnpm icons:build`).

### Phase C — Consumption hardening

- Enforce app usage through `Icon` wrapper and/or direct generated exports.
- Keep fill and directional metadata parity (`mirrorInRTL`) for migrated icons.
- Validate no stray `lucide-react` imports in UI paths.

### Phase D — Quality gates

- Visual sanity pass on Studio, Editor, Explorer, and Export panels.
- Run determinism + CI-equivalent checks.
- Verify reduced-motion and RTL behavior on affected icons.

### Phase E — Rollout policy

- Feature-flag cutover (`NEXT_PUBLIC_USE_HIERO_ICONS`) if rollback is needed.
- Keep `lucide-react` only as import-source dependency; not as UI runtime dependency.

---

## 2) Edit + publish project plan ("publish right away")

## Product contract

The editable project for UI icons lives in-repo and publishes back to the app by regenerating `@hiero/ui-icons` artifacts from source JSON, then committing those generated files.

### Canonical project location

- `packages/hiero-ui-icons/source/icons.json` — editable icon set source.
- `packages/hiero-ui-icons/source/manifest.json` — scope control (which icons belong to the set).
- `packages/hiero-ui-icons/generated/` + `packages/hiero-ui-icons/src/registry.generated.ts` — publish artifacts.

### Authoring flow (same-day loop)

1. Open Hiero and import/load `packages/hiero-ui-icons/source/icons.json`.
2. Edit icon geometry/states/transitions.
3. Export back to `packages/hiero-ui-icons/source/icons.json`.
4. Regenerate package outputs: `pnpm icons:build`.
5. Validate determinism: `pnpm icons:verify`.
6. Run app checks and commit.

### "Publish right away" modes

#### Mode 1 — Internal app publish (default)

- Commit source + generated outputs.
- App immediately consumes updated workspace package (`@hiero/ui-icons` via `workspace:*`).

#### Mode 2 — Source distribution (optional)

- If needed for downstream consumer repos, use existing Lane 1/Lane 2 distribution flow from the app (live sync / release flow).
- This does not replace the in-repo package flow; it complements it.

---

## Operational checklists

### Change checklist (per icon update)

- [ ] Edit performed in `source/icons.json` via Hiero.
- [ ] `pnpm icons:build` ran and generated files were updated.
- [ ] `pnpm icons:verify` passed.
- [ ] Lint/test/build passed for app.
- [ ] Source + generated artifacts committed together.

### CI checklist

- [ ] `bun install --frozen-lockfile`
- [ ] `bun run format:check`
- [ ] `bun run lint`
- [ ] `bun test`
- [ ] `pnpm build`

---

## Risks and mitigations

- **Risk:** Source/generated drift.
  - **Mitigation:** keep `pnpm icons:verify` as required pre-merge gate.
- **Risk:** Visual regressions in dense editor UI.
  - **Mitigation:** require targeted visual dogfood pass before merge.
- **Risk:** Alias mismatch from historical Lucide names.
  - **Mitigation:** preserve alias resolution in codegen and add tests when new aliases are introduced.

---

## Ownership and follow-up

- Maintain this plan alongside `DECISIONS.md` and `INVENTORY.md`.
- If process changes materially (new export command, new registry shape), update this doc in the same PR.
