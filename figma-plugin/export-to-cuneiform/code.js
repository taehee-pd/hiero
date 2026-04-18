figma.showUI(__html__, {
  width: 420,
  height: 560,
  themeColors: true,
});

const MAX_EXPORTS = 50;

function isExportableNode(node) {
  return (
    node &&
    typeof node.exportAsync === 'function' &&
    typeof node.name === 'string' &&
    node.visible !== false
  );
}

function inferFrameName(node) {
  let current = node.parent;
  while (current) {
    if (current.type === 'FRAME' || current.type === 'COMPONENT' || current.type === 'COMPONENT_SET') {
      return current.name;
    }
    current = current.parent;
  }
  return '';
}

async function exportSelection() {
  const selection = figma.currentPage.selection;
  if (!selection.length) {
    figma.ui.postMessage({
      type: 'error',
      message: 'Select one or more vector or component nodes before exporting.',
    });
    return;
  }

  const limitedSelection = selection.slice(0, MAX_EXPORTS);
  const skipped = [];
  const icons = [];

  for (const node of limitedSelection) {
    if (!isExportableNode(node)) {
      skipped.push({
        nodeId: node.id,
        name: node.name || node.type,
        reason: 'Node cannot be exported as SVG.',
      });
      continue;
    }

    try {
      const svgBytes = await node.exportAsync({
        format: 'SVG',
        svgIdAttribute: true,
      });
      const svgContent = new TextDecoder().decode(svgBytes);
      icons.push({
        name: node.name || `Node ${node.id}`,
        nodeId: node.id,
        svgContent,
        sourcePage: figma.currentPage.name,
        sourceFrame: inferFrameName(node),
      });
    } catch (error) {
      skipped.push({
        nodeId: node.id,
        name: node.name || node.type,
        reason: error instanceof Error ? error.message : 'Unknown SVG export error.',
      });
    }
  }

  if (!icons.length) {
    figma.ui.postMessage({
      type: 'error',
      message: 'No selected nodes could be exported as SVG.',
      skipped,
    });
    return;
  }

  figma.ui.postMessage({
    type: 'export-ready',
    payload: {
      version: '1',
      source: 'cuneiform-figma-plugin',
      exportedAt: new Date().toISOString(),
      fileName: figma.root.name || 'Figma File',
      icons,
      skipped,
    },
  });
}

figma.ui.onmessage = async (message) => {
  if (message.type === 'export-selection') {
    await exportSelection();
  }

  if (message.type === 'close-plugin') {
    figma.closePlugin();
  }
};
