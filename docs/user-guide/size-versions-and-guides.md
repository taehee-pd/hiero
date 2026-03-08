# Size Versions and Guides

[Home](./index.md) | [Previous: Drawing and Editing](./drawing-and-editing.md) | [Next: Saving, Importing, Exporting, and Shortcuts](./files-export-and-shortcuts.md)

## Size Versions

Each icon can have multiple size-specific versions. This is useful when a small icon needs different optical adjustments than a large one.

Examples:

- `12` for tiny interface labels
- `16` for compact controls
- `24` for standard app icons
- `48` for larger display use

## Switching Versions

Above the canvas, you will see size chips for the current icon. Choose a chip to switch editing focus to that version.

The canvas header shows which version you are editing right now.

## Adding a New Version

Use the `Variant` button above the canvas to add a new version.

You can:

- choose a common preset size such as `12`, `16`, `20`, `24`, `32`, or `48`
- type any custom numeric size

When a new version is created:

- its drawing layers are copied from the current version
- its viewing area is scaled automatically
- its path shapes stay unchanged until you make optical corrections

That means the new version starts as a close copy, but you can fine-tune it independently.

## Removing a Version

Use the remove button near the version picker to delete the current version. The app will not let you remove the last remaining version.

## Guide Overlays

Guide overlays help you keep icons aligned and visually balanced. They can include:

- horizontal lines
- vertical lines
- rectangles
- ellipses
- point-based references

Guides are reusable across icons, and the editor highlights the guide overlay that matches the version you are currently working on.

## Working With Guides on the Canvas

When guides are visible:

- the rulers appear around the canvas
- drag out from the top ruler to create a horizontal guide
- drag out from the left ruler to create a vertical guide
- click a guide to select it
- drag a selection box across the canvas to select ruler guides together with layers or points
- drag an existing guide to reposition it
- guides stay visible even when you drag them outside the editable icon area
- hold `Option` on Mac or `Alt` on Windows while dragging a guide to duplicate it
- drag a guide back into its ruler to remove it
- release a guide outside the editable canvas to discard it
- snapping can use guide positions as alignment targets

Simple clicks on a ruler no longer create a guide. A guide is only created after an intentional drag, which makes the interaction much closer to Figma. Guides are shown in cyan, and the selected guide becomes a darker, thicker cyan line so it stays easy to track.

## Managing Guide Sets

Open the guide manager from the left side to:

- create a new guide set from a preset
- start from standard sizes or enter a custom size
- duplicate an existing guide set
- rename a guide set
- add or remove guide items
- toggle guide visibility
- switch between subtle and strong display styles

## When to Create a Separate Size Version

Create a separate version when:

- stroke weight feels too heavy or too light at a new size
- corners need to be simplified
- counters or gaps close up
- details need to be removed or enlarged
- the icon feels visually off-center at smaller sizes

## Related Pages

- [Drawing and Editing](./drawing-and-editing.md)
- [Saving, Importing, Exporting, and Shortcuts](./files-export-and-shortcuts.md)
