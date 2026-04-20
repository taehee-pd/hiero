# `@hiero/cli`

The Hiero command-line tool. Lets a host repository drive the
icon-authoring workflow without opening the web app — scaffold, validate,
run a live integration dev server, and produce a deterministic snapshot
build.

> Status: **0.2.x** — early access. The command surface is still evolving;
> see [Known limitations](#known-limitations) below before you wire this
> into a production pipeline.

## Install

```bash
npm install -g @hiero/cli
# or, scoped to a project:
npm install --save-dev @hiero/cli
```

The package is published with [npm provenance](https://docs.npmjs.com/generating-provenance-statements),
so each tarball links back to the exact GitHub Actions workflow run and
commit that built it.

### Requirements

- **Node ≥ 18.** No Bun runtime requirement — `bun` is a build-time dev
  dependency, not a runtime dependency.
- A repo with a `hiero.config.ts` (run `hiero init` if you don't have
  one yet).

## Commands

```bash
hiero init               # Scaffold hiero.config.ts and source directory
hiero dev [--port N]     # Live integration dev server (Lane 1)
hiero build              # Deterministic snapshot build (Lane 2)
hiero validate           # Validate config + source files
```

Run `hiero <command> --help` for per-command flags.

### `hiero init`

Creates a `hiero.config.ts` file in the current directory plus a sample
`icons/` source folder. Safe to run more than once — it skips files that
already exist.

### `hiero dev`

Starts the **live integration dev server** that the editor uses to push
edits into your repo. The server speaks the same protocol as Hiero's
hosted Studio "Publish" panel; you can point your local Studio at
`http://localhost:4400` (or whatever `--port` you set) and edits land in
your repo as you make them.

### `hiero build`

Runs the **deterministic snapshot build**. Reads everything under
`icons/` per `hiero.config.ts`, validates it, and writes the published
package layout to the configured `releaseTargets`. Output is byte-stable
across runs for the same input — safe to commit.

### `hiero validate`

Validates `hiero.config.ts` and every icon source file against the
schema. Exits non-zero on any error. Use it as a pre-commit hook or in CI.

## Versioning

CLI releases use a standalone `cli-vX.Y.Z` tag namespace so that publishing
the CLI is decoupled from the web app. Pushing a `cli-v*` tag triggers
`.github/workflows/cli-release.yml`, which builds, smoke-tests, and
publishes the package to npm with provenance.

## Known limitations

The 0.2.x line is intentionally narrow:

- **No project sync UI.** `hiero dev` runs the integration server but
  does not yet ship its own TUI. Use the hosted Studio for the visual
  workflow.
- **No managed transitions.** The CLI can build and validate icon
  packages, but it does not yet expose a way to author cross-icon
  transitions from the terminal — that flow still lives in the web app's
  Animate panel (see [`docs_canonical/ANIMATE_PANEL_REVAMP_PLAN.md`](../../docs_canonical/ANIMATE_PANEL_REVAMP_PLAN.md)).
- **No watch mode for `hiero build`.** Re-run on save manually for now.
- **No GitHub PR sync.** Use the hosted Studio's Publish → GitHub PR flow.

If a feature you need is missing, file an issue at
<https://github.com/taehee-pd/icon-authoring-tool/issues>.

## License

[MIT](../../LICENSE)
