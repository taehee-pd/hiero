# Repo-Native Workflow

**Status:** Proposed
**Primary future files:** `components/explorer/ExplorerShell.tsx`, `components/editor/EditorShell.tsx`, `components/editor/ImportIconDialog.tsx`

## Overview

This spec describes the intended user workflow for Cuneiform as a repo-native icon authoring platform.

It is not a screen inventory. It is the product workflow that the screens must support.

## Product Promise

```text
Import from Figma once,
then Cuneiform owns the icon system
and publishes to the codebase.
```

## Primary User

First wedge:

- React design-system team

Why:

- icon handoff pain is sharp
- React code output is already a strong fit for the repo
- the current codebase is the real product surface

## Core Workflow

### Step 1: Figma ingress

The designer exports icons from Figma using a Cuneiform plugin.

Expected result:

- the payload lands in Cuneiform without manual SVG-by-SVG cleanup
- imported icons become canonical source candidates

### Step 2: Cuneiform becomes SSOT

After import, the user edits icons in Cuneiform.

Expected result:

- icon structure, variants, transitions, and metadata are owned by Cuneiform
- Figma is no longer treated as co-equal authority

### Step 3: Repo-aware editing

Cuneiform is opened against the current codebase context.

Expected result:

- the editor understands the repo config
- the user is working inside a project, not in an isolated export app

### Step 4: Direct publish to codebase

The user publishes directly into the current React codebase.

Expected result:

- React-usable icon outputs are written into the host repo
- design-system teams do not manually convert or reference SVGs one by one

### Step 5: Optional back-sync

In some cases, the team re-syncs icon outputs or metadata back to Figma.

Expected result:

- back-sync is possible, but it does not move SSOT away from Cuneiform

## Workflow Diagram

```text
Designer in Figma
  -> Export via plugin
  -> Cuneiform import
  -> Cuneiform editing and ownership
  -> Publish into host React repo
  -> host codebase consumes outputs
  -> optional back-sync to Figma
```

## Required UX Properties

- import should feel like starting the system, not like dropping files into a converter
- publishing should feel codebase-native
- the host codebase should be the first convincing proof of value
- the user should understand when Cuneiform, not Figma, owns the icon set

## Non-Goals

- Cuneiform should not feel like a generic "send icons to many destinations" panel
- the first-time workflow should not depend on package registry setup
- the user should not need to manually reference individual SVG files in React

## Required States

### Empty state

Message should point to Figma ingress first for the initial wedge.

### Imported but unpublished

The system should clearly show:

- icons are inside Cuneiform
- Cuneiform is now authoritative
- publish to repo is the next meaningful action

### Published with live host

The system should clearly show:

- host app is reflecting current icon state
- release sync is optional, not required for local feedback

### Back-sync capable

The system should clearly show:

- Figma sync is downstream
- it does not replace Cuneiform ownership

## Key Copy Principles

- talk about "publish to codebase", not "export files"
- talk about "import from Figma", not "sync from Figma"
- avoid language that implies Figma and Cuneiform are equal sources of truth

## Testing Requirements

- initial user path from Figma ingress to first React publish is clear
- users can tell when Cuneiform becomes authoritative
- repo-native workflow is understandable without extra docs
- back-sync does not confuse source-of-truth ownership
