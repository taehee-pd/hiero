# Figma Plugin Export Guide

Use the local `Export to Hiero` Figma plugin when you want to move selected icons from Figma into Hiero without managing API tokens.

## Install The Plugin

1. Open Figma desktop.
2. Go to `Plugins` → `Development` → `Import plugin from manifest...`.
3. Choose [manifest.json](/Users/taehee/Hiero/figma-plugin/export-to-hiero/manifest.json).

## Export From Figma

1. Open the Figma file that contains your icon nodes.
2. Select one or more vector or component nodes.
3. Run `Export to Hiero`.
4. Click `Export selection`.
5. Copy the JSON payload or download it as a file.

The plugin exports:

- selected node name
- node id
- SVG content
- page/frame provenance
- skipped-node diagnostics when a selection cannot be exported

## Import Into Hiero

1. Open `Import icon` in Hiero.
2. Choose `Hiero Plugin`.
3. Paste the JSON payload or upload the downloaded `.json` file.
4. Click `Import Plugin Payload`.

Hiero sanitizes and normalizes each SVG before inserting it into the workspace, so the plugin path uses the same import hardening as the other SVG sources.

## What Gets Skipped

The plugin skips nodes that cannot be exported as SVG from the active selection. For example:

- invisible nodes
- node types without `exportAsync`
- nodes that fail SVG export in Figma

The export still succeeds if at least one selected node can be converted.
