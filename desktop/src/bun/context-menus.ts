import type { ApplicationMenuItemConfig } from 'electrobun/bun';
import type { DesktopContextMenuKind } from '../shared/rpc-types';

export function buildContextMenu(
  menu: DesktopContextMenuKind,
  payload: Record<string, unknown> = {},
): ApplicationMenuItemConfig[] {
  switch (menu) {
    case 'layerPanel':
      return [
        item('Rename', 'context.layer.rename', payload),
        item('Duplicate', 'context.layer.duplicate', payload),
        item('Delete', 'context.layer.delete', payload),
        { type: 'separator' },
        item('Move Up', 'context.layer.moveUp', payload),
        item('Move Down', 'context.layer.moveDown', payload),
      ];
    case 'canvas':
      return [
        item('Paste', 'context.canvas.paste', payload),
        { type: 'separator' },
        item('Zoom In', 'context.canvas.zoomIn', payload),
        item('Zoom Out', 'context.canvas.zoomOut', payload),
        item('Fit to Canvas', 'context.canvas.fitCanvas', payload),
      ];
    case 'explorerIcon':
      return [
        item('Open in Editor', 'context.explorer.openEditor', payload),
        item('Add to Collection', 'context.explorer.addCollection', payload),
        item('Favorite', 'context.explorer.favorite', payload),
        { type: 'separator' },
        item('Export SVG', 'context.explorer.exportSvg', payload),
        item('Delete', 'context.explorer.delete', payload),
      ];
  }
}

function item(
  label: string,
  action: string,
  data: Record<string, unknown>,
): ApplicationMenuItemConfig {
  return {
    label,
    action,
    data,
  };
}
